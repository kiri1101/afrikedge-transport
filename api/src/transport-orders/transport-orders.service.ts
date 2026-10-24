import { Injectable } from '@nestjs/common';
import { CurrentUser } from '../auth/users';
import { Clock } from '../common/clock';
import { DomainError } from '../common/domain-error';
import { Page } from '../common/pagination';
import { SqlRunner, SqlService } from '../database/sql.service';
import { nextTransportOrderNo } from '../domain/order-number';
import {
  allowedActions,
  assertDeliveryDateNotPast,
  assertVehicleFree,
  assertVehicleUsable,
} from '../domain/rules';
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
}
