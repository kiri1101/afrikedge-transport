import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Recreates the TransportPlanning database from the provided init.sql. */
export function resetDb(): void {
  execSync('npm run --silent db:reset', {
    cwd: resolve(__dirname, '../..'),
    stdio: 'ignore',
  });
}
