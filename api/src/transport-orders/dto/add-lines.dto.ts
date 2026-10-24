import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizeCode } from './create-transport-order.dto';

export class AddLinesDto {
  /**
   * 1 to 50 sales order numbers, trimmed and upper-cased. Duplicates are not rejected here:
   * the domain refuses them with DUPLICATE_SALES_ORDERS.
   */
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => normalizeCode({ value: v }))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  salesOrderNos!: string[];
}
