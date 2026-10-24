import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { RequestContextMiddleware } from './audit/request-context.middleware';
import { UserGuard } from './auth/user.guard';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';
import { TransportOrdersModule } from './transport-orders/transport-orders.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    CommonModule,
    DatabaseModule,
    VehiclesModule,
    SalesOrdersModule,
    TransportOrdersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
