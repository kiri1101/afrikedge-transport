import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { offsetOf, Page } from '../common/pagination';
import { SqlParams, SqlRunner } from '../database/sql.service';
import {
  TRANSPORT_ORDER_STATUS_CODE,
  transportOrderStatusFromCode,
} from '../domain/statuses';
import {
  SALES_ORDER_COLUMNS,
  SalesOrderRow,
  toSalesOrderDto,
} from '../sales-orders/sales-orders.repository';
import { SalesOrderDto } from '../sales-orders/sales-order.dto';
import { ListTransportOrdersQuery } from './dto/list-transport-orders.query';
import { TransportOrderSummaryDto } from './dto/transport-order.dto';

/**
 * One summary query for lists and details: version as hex, date as YYYY-MM-DD,
 * line count and total weight summed in SQL (exact decimals).
 */
const SUMMARY_SELECT = `
  SELECT t.[No_] AS no,
         CONVERT(char(16), CONVERT(binary(8), t.[timestamp]), 2) AS version,
         t.[Status] AS statusCode,
         CONVERT(char(10), t.[Delivery Date], 23) AS deliveryDate,
         t.[Vehicle Code] AS vehicleCode,
         v.[Plate No_] AS plateNo,
         v.[Capacity (kg)] AS capacityKg,
         agg.lineCount,
         agg.totalWeightKg,
         t.[Created By] AS createdBy,
         t.[Validated By] AS validatedBy
  FROM [Transport Order] t
  LEFT JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
  OUTER APPLY (
    SELECT COUNT(*) AS lineCount, ISNULL(SUM(so.[Total Weight (kg)]), 0) AS totalWeightKg
    FROM [Transport Order Line] l
    JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
    WHERE l.[Transport Order No_] = t.[No_]
  ) agg`;

type SummaryRow = Omit<TransportOrderSummaryDto, 'status'> & {
  statusCode: number;
};

function toSummary({
  statusCode,
  ...row
}: SummaryRow): TransportOrderSummaryDto {
  return {
    ...row,
    status: transportOrderStatusFromCode(statusCode),
    capacityKg: Number(row.capacityKg),
    totalWeightKg: Number(row.totalWeightKg),
  };
}

@Injectable()
export class TransportOrdersRepository {
  async list(
    runner: SqlRunner,
    query: ListTransportOrdersQuery,
  ): Promise<Page<TransportOrderSummaryDto>> {
    const conditions: string[] = [];
    const params: SqlParams = {};
    if (query.status) {
      conditions.push('t.[Status] = @status');
      params.status = [sql.TinyInt, TRANSPORT_ORDER_STATUS_CODE[query.status]];
    }
    if (query.deliveryDate) {
      conditions.push('t.[Delivery Date] = CONVERT(date, @deliveryDate, 23)');
      params.deliveryDate = [sql.NVarChar(10), query.deliveryDate];
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const page = await runner.query<SummaryRow>(
      `${SUMMARY_SELECT}
       ${where}
       ORDER BY t.[Delivery Date] DESC, t.[No_] DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      {
        ...params,
        offset: [sql.Int, offsetOf(query)],
        pageSize: [sql.Int, query.pageSize],
      },
    );
    const count = await runner.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM [Transport Order] t ${where}`,
      params,
    );

    return {
      items: page.rows.map(toSummary),
      page: query.page,
      pageSize: query.pageSize,
      total: count.rows[0].total,
    };
  }

  async findSummary(
    runner: SqlRunner,
    no: string,
  ): Promise<TransportOrderSummaryDto | null> {
    const { rows } = await runner.query<SummaryRow>(
      `${SUMMARY_SELECT} WHERE t.[No_] = @no`,
      {
        no: [sql.NVarChar(20), no],
      },
    );
    return rows.length > 0 ? toSummary(rows[0]) : null;
  }

  async findLines(runner: SqlRunner, no: string): Promise<SalesOrderDto[]> {
    const { rows } = await runner.query<SalesOrderRow>(
      `SELECT ${SALES_ORDER_COLUMNS}
       FROM [Transport Order Line] l
       JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
       WHERE l.[Transport Order No_] = @no
       ORDER BY so.[No_]`,
      { no: [sql.NVarChar(20), no] },
    );
    return rows.map(toSalesOrderDto);
  }
}
