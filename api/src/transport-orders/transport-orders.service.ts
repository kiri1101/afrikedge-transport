import { Injectable } from '@nestjs/common';
import { CurrentUser } from '../auth/users';
import { Clock } from '../common/clock';
import { DomainError } from '../common/domain-error';
import { Page } from '../common/pagination';
import { SqlRunner, SqlService } from '../database/sql.service';
import { nextTransportOrderNo } from '../domain/order-number';
import {
  allowedActions,
  assertCanAddLines,
  assertCanDepart,
  assertCanRemoveLine,
  assertCanValidate,
  assertDeliveryDateNotPast,
  assertVehicleFree,
  assertVehicleUsable,
  OrderState,
} from '../domain/rules';
import { SalesOrdersRepository } from '../sales-orders/sales-orders.repository';
import { toHundredths, toKg } from '../domain/weights';
import { CreateTransportOrderDto } from './dto/create-transport-order.dto';
import { ListTransportOrdersQuery } from './dto/list-transport-orders.query';
import {
  TransportOrderDetailDto,
  TransportOrderSummaryDto,
} from './dto/transport-order.dto';
import { TransportOrdersRepository } from './transport-orders.repository';

@Injectable()
export class TransportOrdersService {
  constructor(
    private readonly sql: SqlService,
    private readonly orders: TransportOrdersRepository,
    private readonly salesOrders: SalesOrdersRepository,
    private readonly clock: Clock,
  ) {}

  /** R1, R2 — locks: vehicle row, then the last order number (always in this order). */
  async create(
    dto: CreateTransportOrderDto,
    user: CurrentUser,
  ): Promise<TransportOrderDetailDto> {
    assertDeliveryDateNotPast(dto.deliveryDate, this.clock.today());

    return this.sql.transaction(async (tx) => {
      const vehicle = await this.orders.lockVehicle(tx, dto.vehicleCode);
      assertVehicleUsable(vehicle, dto.vehicleCode);
      const booked = await this.orders.findOrderNoFor(
        tx,
        dto.vehicleCode,
        dto.deliveryDate,
      );
      assertVehicleFree(booked, dto.vehicleCode, dto.deliveryDate);

      const no = nextTransportOrderNo(await this.orders.lastOrderNo(tx));
      await this.orders.insert(tx, {
        no,
        vehicleCode: vehicle!.code,
        deliveryDate: dto.deliveryDate,
        createdBy: user.id,
      });
      return this.getDetail(no, user, tx);
    });
  }

  list(
    query: ListTransportOrdersQuery,
  ): Promise<Page<TransportOrderSummaryDto>> {
    return this.orders.list(this.sql, query);
  }

  /** Mutations call this with their transaction so they return what they just wrote. */
  async getDetail(
    no: string,
    user: CurrentUser,
    runner: SqlRunner = this.sql,
  ): Promise<TransportOrderDetailDto> {
    const summary = await this.orders.findSummary(runner, no);
    if (!summary)
      throw new DomainError('TRANSPORT_ORDER_NOT_FOUND', {
        transportOrderNo: no,
      });
    const lines = await this.orders.findLines(runner, summary.no);

    return {
      ...summary,
      remainingKg: toKg(
        toHundredths(summary.capacityKg) - toHundredths(summary.totalWeightKg),
      ),
      lines,
      allowedActions: allowedActions(summary, user.role),
    };
  }

  /** R3–R7: all or nothing, under the header lock. */
  async addLines(
    no: string,
    version: string,
    salesOrderNos: string[],
    user: CurrentUser,
  ): Promise<TransportOrderDetailDto> {
    return this.sql.transaction(async (tx) => {
      const order = await this.lockOrFail(tx, no, version);
      const found = await this.salesOrders.findCandidates(tx, salesOrderNos);
      assertCanAddLines(order, salesOrderNos, found);

      // Defence in depth: the candidates are locked, so this should always move every row.
      const planned = await this.salesOrders.setStatus(
        tx,
        salesOrderNos,
        'PLANNED',
        'TO_PLAN',
      );
      if (planned !== salesOrderNos.length) {
        throw new DomainError('SALES_ORDER_NOT_PLANNABLE', { salesOrderNos });
      }
      await this.orders.insertLines(tx, order.no, salesOrderNos);
      return this.getDetail(order.no, user, tx);
    });
  }

  /** R6, R7 */
  async removeLine(
    no: string,
    version: string,
    salesOrderNo: string,
    user: CurrentUser,
  ): Promise<TransportOrderDetailDto> {
    return this.sql.transaction(async (tx) => {
      const order = await this.lockOrFail(tx, no, version);
      const lineExists = await this.orders.lineExists(
        tx,
        order.no,
        salesOrderNo,
      );
      assertCanRemoveLine(order, lineExists, salesOrderNo);

      await this.orders.deleteLine(tx, order.no, salesOrderNo);
      await this.salesOrders.setStatus(
        tx,
        [salesOrderNo],
        'TO_PLAN',
        'PLANNED',
      );
      return this.getDetail(order.no, user, tx);
    });
  }

  /** R8 — the role was checked by the action guard. */
  async validate(
    no: string,
    version: string,
    user: CurrentUser,
  ): Promise<TransportOrderDetailDto> {
    return this.sql.transaction(async (tx) => {
      const order = await this.lockOrFail(tx, no, version);
      assertCanValidate(order);
      await this.orders.markValidated(tx, order.no, user.id);
      return this.getDetail(order.no, user, tx);
    });
  }

  /** R9 — the order leaves; its sales orders go "in delivery". */
  async depart(
    no: string,
    version: string,
    user: CurrentUser,
  ): Promise<TransportOrderDetailDto> {
    return this.sql.transaction(async (tx) => {
      const order = await this.lockOrFail(tx, no, version);
      assertCanDepart(order);
      await this.orders.markDeparted(tx, order.no);
      const salesOrderNos = await this.orders.lineNos(tx, order.no);
      if (salesOrderNos.length > 0) {
        await this.salesOrders.setStatus(
          tx,
          salesOrderNos,
          'IN_DELIVERY',
          'PLANNED',
        );
      }
      return this.getDetail(order.no, user, tx);
    });
  }

  /** Locks the header if `version` is current; otherwise 404 (no such order) or 412 (stale). */
  private async lockOrFail(
    tx: SqlRunner,
    no: string,
    version: string,
  ): Promise<OrderState> {
    if (!(await this.orders.lockHeader(tx, no, version))) {
      throw (await this.orders.exists(tx, no))
        ? new DomainError('STALE_VERSION', { transportOrderNo: no })
        : new DomainError('TRANSPORT_ORDER_NOT_FOUND', {
            transportOrderNo: no,
          });
    }
    const summary = await this.orders.findSummary(tx, no);
    return {
      no: summary!.no,
      status: summary!.status,
      capacity: toHundredths(summary!.capacityKg),
      load: toHundredths(summary!.totalWeightKg),
      lineCount: summary!.lineCount,
    };
  }
}
