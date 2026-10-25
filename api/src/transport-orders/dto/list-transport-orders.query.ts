import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/pagination';
import type { TransportOrderStatus } from '../../domain/statuses';

export class ListTransportOrdersQuery extends PageQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'VALIDATED', 'DEPARTED'])
  status?: TransportOrderStatus;

  /** YYYY-MM-DD */
  @IsOptional()
  // IsISO8601 strict alone accepts week dates (2026-W43-1), which SQL CONVERT(…, 23) rejects with a 500.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  deliveryDate?: string;
}
