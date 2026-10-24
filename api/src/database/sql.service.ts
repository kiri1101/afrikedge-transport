import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
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

  constructor(private readonly config: ConfigService) {}

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
    return run<T>(this.pool.request(), text, params);
  }

  /** Runs `work` in one transaction: committed if it resolves, rolled back if it throws. */
  async transaction<T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> {
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    const runner: SqlRunner = {
      query: (text, params) => run(new sql.Request(transaction), text, params),
    };
    try {
      await runner.query('SET LOCK_TIMEOUT 5000');
      const result = await work(runner);
      await transaction.commit();
      return result;
    } catch (error) {
      // SQL Server has already rolled back a deadlock victim; a second rollback would throw
      // and hide the original error, which is the one worth reporting.
      await transaction.rollback().catch(() => undefined);
      throw translate(error);
    }
  }
}

async function run<T>(
  request: sql.Request,
  text: string,
  params: SqlParams = {},
): Promise<SqlResult<T>> {
  for (const [name, [type, value]] of Object.entries(params)) {
    request.input(name, type, value);
  }
  const result = await request.query<T>(text);
  return {
    rows: result.recordset ?? [],
    rowsAffected: result.rowsAffected.reduce((sum, n) => sum + n, 0),
  };
}

function translate(error: unknown): unknown {
  const number = (error as { number?: number }).number;
  return number === DEADLOCK_VICTIM || number === LOCK_TIMEOUT
    ? new DomainError('CONCURRENT_UPDATE')
    : error;
}
