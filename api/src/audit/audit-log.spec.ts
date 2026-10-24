import { AuditLog, classifySql, compactSql, MemorySink } from './audit-log';
import { requestContext } from './request-context';

describe('classifySql', () => {
  it('tells reads from writes', () => {
    expect(classifySql('  SELECT 1')).toBe('db.read');
    expect(classifySql('UPDATE [Transport Order] SET …')).toBe('db.write');
    expect(classifySql('INSERT INTO [Transport Order Line] …')).toBe(
      'db.write',
    );
    expect(classifySql('delete from x')).toBe('db.write');
    expect(classifySql('SET LOCK_TIMEOUT 5000')).toBe('db.session');
  });
});

describe('compactSql', () => {
  it('collapses whitespace to one line', () => {
    expect(compactSql('SELECT a,\n       b\n  FROM t')).toBe(
      'SELECT a, b FROM t',
    );
  });

  it('truncates long statements', () => {
    expect(compactSql(`SELECT ${'x'.repeat(600)}`)).toHaveLength(500);
  });
});

describe('AuditLog', () => {
  it('stamps entries with time, request id and user from the request context', () => {
    const sink = new MemorySink();
    const audit = new AuditLog([sink]);

    requestContext.run({ requestId: 'req-1', user: 'eric' }, () =>
      audit.record('db.read', { rows: 2 }),
    );

    expect(sink.entries[0]).toMatchObject({
      type: 'db.read',
      requestId: 'req-1',
      user: 'eric',
      rows: 2,
    });
    expect(sink.entries[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records entries outside a request with a null request id', () => {
    const sink = new MemorySink();

    new AuditLog([sink]).record('db.session', {});

    expect(sink.entries[0]).toMatchObject({ requestId: null, user: null });
  });
});
