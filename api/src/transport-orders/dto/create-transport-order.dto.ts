import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Length,
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
  @IsISO8601({ strict: true })
  @Length(10, 10)
  deliveryDate!: string;
}
