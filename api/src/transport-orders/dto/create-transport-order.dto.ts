import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const normalizeCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateTransportOrderDto {
  /** Vehicle code, e.g. VH-05. */
  @Transform(normalizeCode)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehicleCode!: string;

  /** YYYY-MM-DD, today or later (Douala time). */
  // IsISO8601 strict alone accepts week dates (2026-W43-1), which SQL CONVERT(…, 23) rejects with a 500.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  deliveryDate!: string;
}
