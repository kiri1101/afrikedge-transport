import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireAction } from '../auth/require-action';
import { IfMatchVersion } from '../common/if-match.decorator';
import { AddLinesDto } from './dto/add-lines.dto';
import {
  CreateTransportOrderDto,
  normalizeCode,
} from './dto/create-transport-order.dto';
import type { CurrentUser as User } from '../auth/users';
import { Page } from '../common/pagination';
import { ListTransportOrdersQuery } from './dto/list-transport-orders.query';
import {
  TransportOrderDetailDto,
  TransportOrderSummaryDto,
} from './dto/transport-order.dto';
import { TransportOrdersService } from './transport-orders.service';

const IF_MATCH = {
  name: 'If-Match',
  required: true,
  description:
    'Version de l\'ordre lue (champ "version" ou en-tête ETag), entre guillemets.',
};

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

  /** Adds one or more sales orders to a Draft order, all or nothing, within capacity. */
  @Post(':no/lines')
  @HttpCode(200)
  @RequireAction('ADD_LINES')
  @ApiHeader(IF_MATCH)
  async addLines(
    @Param('no') no: string,
    @IfMatchVersion() version: string,
    @Body() dto: AddLinesDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransportOrderDetailDto> {
    return withETag(
      res,
      await this.service.addLines(no, version, dto.salesOrderNos, user),
    );
  }

  /** Removes a sales order from a Draft order; it goes back to "to plan". */
  @Delete(':no/lines/:salesOrderNo')
  @RequireAction('REMOVE_LINES')
  @ApiHeader(IF_MATCH)
  async removeLine(
    @Param('no') no: string,
    @Param('salesOrderNo') salesOrderNo: string,
    @IfMatchVersion() version: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransportOrderDetailDto> {
    const normalized = normalizeCode({ value: salesOrderNo }) as string;
    return withETag(
      res,
      await this.service.removeLine(no, version, normalized, user),
    );
  }
}
