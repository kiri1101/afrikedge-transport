import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { offsetOf, Page } from '../common/pagination';
import { SqlParams, SqlService } from '../database/sql.service';
import { salesOrderStatusFromCode } from '../domain/statuses';
import { SalesOrderDto } from './sales-order.dto';
import { ToPlanQuery } from './to-plan.query';

/** Column list shared by every query returning sales orders; `so` is the [Sales Order] alias. */
export const SALES_ORDER_COLUMNS = `so.[No_] AS no, so.[Customer No_] AS customerNo, so.[Customer Name] AS customerName,
  so.[Delivery City] AS deliveryCity, so.[Total Weight (kg)] AS totalWeightKg, so.[Status] AS statusCode`;

export type SalesOrderRow = Omit<SalesOrderDto, 'status'> & {
  statusCode: number;
};

export function toSalesOrderDto({
  statusCode,
  ...row
}: SalesOrderRow): SalesOrderDto {
  return {
    ...row,
    totalWeightKg: Number(row.totalWeightKg),
    status: salesOrderStatusFromCode(statusCode),
  };
}

@Injectable()
export class SalesOrdersRepository {
  constructor(private readonly sql: SqlService) {}

  async findToPlan(query: ToPlanQuery): Promise<Page<SalesOrderDto>> {
    const params: SqlParams = {};
    let where = 'so.[Status] = 0';
    if (query.city) {
      where += ' AND so.[Delivery City] = @city';
      params.city = [sql.NVarChar(50), query.city];
    }

    const page = await this.sql.query<SalesOrderRow>(
      `SELECT ${SALES_ORDER_COLUMNS}
       FROM [Sales Order] so
       WHERE ${where}
       ORDER BY so.[No_]
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      {
        ...params,
        offset: [sql.Int, offsetOf(query)],
        pageSize: [sql.Int, query.pageSize],
      },
    );
    const count = await this.sql.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM [Sales Order] so WHERE ${where}`,
      params,
    );

    return {
      items: page.rows.map(toSalesOrderDto),
      page: query.page,
      pageSize: query.pageSize,
      total: count.rows[0].total,
    };
  }

  async findToPlanCities(): Promise<string[]> {
    const { rows } = await this.sql.query<{ city: string }>(
      `SELECT DISTINCT [Delivery City] AS city FROM [Sales Order] WHERE [Status] = 0 ORDER BY [Delivery City]`,
    );
    return rows.map((row) => row.city);
  }
}
