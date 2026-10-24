import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export function offsetOf(query: PageQueryDto): number {
  return (query.page - 1) * query.pageSize;
}
