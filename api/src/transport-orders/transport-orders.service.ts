import { Injectable } from '@nestjs/common';
import { CurrentUser } from '../auth/users';
import { DomainError } from '../common/domain-error';
import { Page } from '../common/pagination';
import { SqlRunner, SqlService } from '../database/sql.service';
import { allowedActions } from '../domain/rules';
import { toHundredths, toKg } from '../domain/weights';
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
  ) {}

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
