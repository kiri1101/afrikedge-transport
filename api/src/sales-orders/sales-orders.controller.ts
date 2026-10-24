import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Page } from '../common/pagination';
import { SalesOrderDto } from './sales-order.dto';
import { SalesOrdersRepository } from './sales-orders.repository';
import { ToPlanQuery } from './to-plan.query';

@ApiTags('sales-orders')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersRepository) {}

  /** Sales orders still to plan, filterable by city, paginated. */
  @Get('to-plan')
  findToPlan(@Query() query: ToPlanQuery): Promise<Page<SalesOrderDto>> {
    return this.salesOrders.findToPlan(query);
  }

  /** Cities having at least one order to plan (feeds the city filter). */
  @Get('to-plan/cities')
  findToPlanCities(): Promise<string[]> {
    return this.salesOrders.findToPlanCities();
  }
}
