import { createWriteStream, mkdirSync, WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { requestContext } from './request-context';

export type AuditType =
  | 'http.request'
  | 'http.response'
  | 'http.error'
  | 'db.read'
  | 'db.write'
  | 'db.session'
  | 'db.transaction'
  | 'db.error';

export type AuditEntry = {
  at: string;
  type: AuditType;
  requestId: string | null;
  user: string | null;
  [field: string]: unknown;
};

export interface AuditSink {
  write(entry: AuditEntry): void;
}

/** Injection token for the list of sinks; tests override it with a MemorySink. */
export const AUDIT_SINKS = Symbol('AUDIT_SINKS');

/** Appends one JSON object per line. */
export class JsonLinesFileSink implements AuditSink {
  private readonly stream: WriteStream;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: 'a' });
  }

  write(entry: AuditEntry): void {
    this.stream.write(`${JSON.stringify(entry)}\n`);
  }
}

export class ConsoleSink implements AuditSink {
  write(entry: AuditEntry): void {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}

export class MemorySink implements AuditSink {
  readonly entries: AuditEntry[] = [];

  write(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

/** Writes audit entries stamped with the time and the current request's id and user. */
export class AuditLog {
  constructor(private readonly sinks: AuditSink[]) {}

  record(type: AuditType, fields: Record<string, unknown>): void {
    const context = requestContext.getStore();
    const entry: AuditEntry = {
      at: new Date().toISOString(),
      type,
      requestId: context?.requestId ?? null,
      user: context?.user ?? null,
      ...fields,
    };
    for (const sink of this.sinks) sink.write(entry);
  }
}

export function classifySql(
  text: string,
): 'db.read' | 'db.write' | 'db.session' {
  const keyword = text.trimStart().slice(0, 6).toUpperCase();
  if (keyword === 'SELECT') return 'db.read';
  if (['INSERT', 'UPDATE', 'DELETE'].includes(keyword)) return 'db.write';
  return 'db.session';
}

const MAX_SQL_LENGTH = 500;

/** One line, bounded length: readable in a log, never a megabyte. */
export function compactSql(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_SQL_LENGTH);
}
