import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll } from 'vitest';
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';

beforeAll(async () => {
  const testEnv = env as { DB: D1Database; TEST_MIGRATIONS: D1Migration[] };
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});
