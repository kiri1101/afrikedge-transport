import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { performance } from 'node:perf_hooks';
import { AuditLog, classifySql, compactSql } from '../audit/audit-log';
import { DomainError } from '../common/domain-error';

export type SqlParams = Record<
  string,
  [type: sql.ISqlType | sql.ISqlTypeFactoryWithNoParams, value: unknown]
>;

export type SqlResult<T> = { rows: T[]; rowsAffected: number };

/** Something that runs a parameterized query: the pool, or a transaction. */
export interface SqlRunner {
  query<T = Record<string, unknown>>(
    text: string,
    params?: SqlParams,
  ): Promise<SqlResult<T>>;
}

/** Builds `@so0, @so1…` placeholders and their parameters: values never enter the SQL text. */
export function inList(
  prefix: string,
  values: string[],
  type: sql.ISqlType | sql.ISqlTypeFactoryWithNoParams,
): { placeholders: string; params: SqlParams } {
  const params: SqlParams = {};
  const names = values.map((value, i) => {
    params[`${prefix}${i}`] = [type, value];
    return `@${prefix}${i}`;
  });
  return { placeholders: names.join(', '), params };
}

const DEADLOCK_VICTIM = 1205;
const LOCK_TIMEOUT = 1222;

@Injectable()
export class SqlService implements SqlRunner, OnModuleInit, OnModuleDestroy {
  private pool!: sql.ConnectionPool;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditLog,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pool = new sql.ConnectionPool({
      server: this.config.get('DB_HOST', 'localhost'),
      port: Number(this.config.get('DB_PORT', 1433)),
      user: this.config.get('DB_USER'),
      password: this.config.get('DB_PASSWORD'),
      database: this.config.get('DB_NAME', 'TransportPlanning'),
      options: { encrypt: true, trustServerCertificate: true },
      pool: { max: 10 },
    });
    await this.pool.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.close();
  }

  query<T = Record<string, unknown>>(
    text: string,
    params?: SqlParams,
  ): Promise<SqlResult<T>> {
    return this.run<T>(this.pool.request(), text, params, false);
  }

  /** Runs `work` in one transaction: committed if it resolves, rolled back if it throws. */
  async transaction<T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> {
    const transaction = new sql.Transaction(this.pool);
    const started = performance.now();
    await transaction.begin();
    this.audit.record('db.transaction', { action: 'begin' });
    const runner: SqlRunner = {
      query: (text, params) =>
        this.run(new sql.Request(transaction), text, params, true),
    };
    try {
      await runner.query('SET LOCK_TIMEOUT 5000');
      const result = await work(runner);
      await transaction.commit();
      this.audit.record('db.transaction', {
        action: 'commit',
        durationMs: elapsed(started),
      });
      return result;
    } catch (error) {
      // SQL Server has already rolled back a deadlock victim; a second rollback would throw
      // and hide the original error, which is the one worth reporting.
      await transaction.rollback().catch(() => undefined);
      this.audit.record('db.transaction', {
        action: 'rollback',
        durationMs: elapsed(started),
        reason: error instanceof DomainError ? error.code : 'error',
      });
      throw translate(error);
    }
  }

  /** Every statement goes through here: parameters bound, then audited as a read or a write. */
  private async run<T>(
    request: sql.Request,
    text: string,
    params: SqlParams = {},
    inTransaction: boolean,
  ): Promise<SqlResult<T>> {
    for (const [name, [type, value]] of Object.entries(params)) {
      request.input(name, type, value);
    }
    const audited = {
      sql: compactSql(text),
      params: Object.fromEntries(
        Object.entries(params).map(([name, [, value]]) => [name, value]),
      ),
      transaction: inTransaction,
    };
    const started = performance.now();

    let result: sql.IResult<T>;
    try {
      result = await request.query<T>(text);
    } catch (error) {
      this.audit.record('db.error', {
        ...audited,
        number: (error as { number?: number }).number,
        message: (error as Error).message,
      });
      throw error;
    }

    const rows = result.recordset ?? [];
    const rowsAffected = result.rowsAffected.reduce((sum, n) => sum + n, 0);
    const type = classifySql(text);
    this.audit.record(type, {
      ...audited,
      ...(type === 'db.read' ? { rows: rows.length } : { rowsAffected }),
      durationMs: elapsed(started),
    });
    return { rows, rowsAffected };
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}

function translate(error: unknown): unknown {
  const number = (error as { number?: number }).number;
  return number === DEADLOCK_VICTIM || number === LOCK_TIMEOUT
    ? new DomainError('CONCURRENT_UPDATE')
    : error;
}
