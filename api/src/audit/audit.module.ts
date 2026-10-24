import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUDIT_SINKS,
  AuditLog,
  AuditSink,
  ConsoleSink,
  JsonLinesFileSink,
} from './audit-log';

@Global()
@Module({
  providers: [
    {
      provide: AUDIT_SINKS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AuditSink[] => {
        if (process.env.NODE_ENV === 'test') return [];
        const sinks: AuditSink[] = [];
        const file = config.get<string>('AUDIT_LOG_FILE', 'logs/audit.log');
        if (file) sinks.push(new JsonLinesFileSink(file));
        if (config.get<string>('AUDIT_LOG_CONSOLE', 'true') === 'true') {
          sinks.push(new ConsoleSink());
        }
        return sinks;
      },
    },
    {
      provide: AuditLog,
      inject: [AUDIT_SINKS],
      useFactory: (sinks: AuditSink[]) => new AuditLog(sinks),
    },
  ],
  exports: [AuditLog],
})
export class AuditModule {}
