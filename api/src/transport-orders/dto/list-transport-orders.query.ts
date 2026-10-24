import { IsIn, IsISO8601, IsOptional, Length } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';
import type { TransportOrderStatus } from '../../domain/statuses';

export class ListTransportOrdersQuery extends PageQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'VALIDATED', 'DEPARTED'])
  status?: TransportOrderStatus;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(10, 10)
  deliveryDate?: string;
}
