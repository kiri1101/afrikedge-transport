import { Module } from '@nestjs/common';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { TransportOrdersController } from './transport-orders.controller';
import { TransportOrdersRepository } from './transport-orders.repository';
import { TransportOrdersService } from './transport-orders.service';

@Module({
  imports: [SalesOrdersModule],
  controllers: [TransportOrdersController],
  providers: [TransportOrdersService, TransportOrdersRepository],
})
export class TransportOrdersModule {}
