import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { UserGuard } from './auth/user.guard';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    DatabaseModule,
    VehiclesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserGuard }],
})
export class AppModule {}
