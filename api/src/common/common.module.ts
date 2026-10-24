import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock, ZonedClock } from './clock';

@Global()
@Module({
  providers: [
    {
      provide: Clock,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ZonedClock(config.get('BUSINESS_TIMEZONE', 'Africa/Douala')),
    },
  ],
  exports: [Clock],
})
export class CommonModule {}
