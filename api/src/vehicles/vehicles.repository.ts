import { Injectable } from '@nestjs/common';
import { SqlService } from '../database/sql.service';
import { VehicleDto } from './vehicle.dto';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly sql: SqlService) {}

  async findActive(): Promise<VehicleDto[]> {
    const { rows } = await this.sql.query<VehicleDto>(
      `SELECT [Code] AS code, [Plate No_] AS plateNo, [Capacity (kg)] AS capacityKg, [Active] AS active
       FROM [Vehicle]
       WHERE [Active] = 1
       ORDER BY [Code]`,
    );
    return rows.map((row) => ({ ...row, capacityKg: Number(row.capacityKg) }));
  }
}
