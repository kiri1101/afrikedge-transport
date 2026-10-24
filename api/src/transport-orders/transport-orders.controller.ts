import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireAction } from '../auth/require-action';
import { CreateTransportOrderDto } from './dto/create-transport-order.dto';
import type { CurrentUser as User } from '../auth/users';
import { Page } from '../common/pagination';
import { ListTransportOrdersQuery } from './dto/list-transport-orders.query';
import {
  TransportOrderDetailDto,
  TransportOrderSummaryDto,
} from './dto/transport-order.dto';
import { TransportOrdersService } from './transport-orders.service';

/** Sends the order's version as ETag so clients can echo it in If-Match. */
export function withETag(
  res: Response,
  detail: TransportOrderDetailDto,
): TransportOrderDetailDto {
  res.setHeader('ETag', `"${detail.version}"`);
  return detail;
}

@ApiTags('transport-orders')
@Controller('transport-orders')
export class TransportOrdersController {
  constructor(private readonly service: TransportOrdersService) {}

  /** Transport orders by delivery date (latest first), filterable by status and date. */
  @Get()
  list(
    @Query() query: ListTransportOrdersQuery,
  ): Promise<Page<TransportOrderSummaryDto>> {
    return this.service.list(query);
  }

  /** One order with its sales orders, remaining capacity and the actions allowed to the caller. */
  @Get(':no')
  async get(
    @Param('no') no: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransportOrderDetailDto> {
    return withETag(res, await this.service.getDetail(no, user));
  }

  /** Creates a Draft order: active vehicle, date not in the past, one order per vehicle and date. */
  @Post()
  @RequireAction('CREATE')
  async create(
    @Body() dto: CreateTransportOrderDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransportOrderDetailDto> {
    const detail = await this.service.create(dto, user);
    res.location(`/transport-orders/${detail.no}`);
    return withETag(res, detail);
  }
}
