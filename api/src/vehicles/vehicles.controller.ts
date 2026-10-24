import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VehicleDto } from './vehicle.dto';
import { VehiclesRepository } from './vehicles.repository';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesRepository) {}

  /** Active vehicles, by code. */
  @Get()
  findActive(): Promise<VehicleDto[]> {
    return this.vehicles.findActive();
  }
}
