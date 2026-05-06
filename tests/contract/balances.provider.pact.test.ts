import { describe, it, beforeAll, afterAll } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg, { type Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '../../src/server';
import type { Server } from 'node:http';

const { Pool: PgPool } = pg;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let server: Server;
let serverPort: number;

// Setup 
beforeAll(async () => {
  // Démarrer Postgres via Testcontainers
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new PgPool({ connectionString: container.getConnectionUri() });

  // Appliquer les migrations
  const migration = await readFile(
    join(process.cwd(), 'migrations', '001-initial.sql'),
    'utf-8',
  );
  await pool.query(migration);

  // Démarrer le vrai serveur Express
  const app = createApp(pool);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve()); // port 0 = port libre automatique
  });
  serverPort = (server.address() as { port: number }).port;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
  await container.stop();
});

// Provider verification 
describe('splitto-api provider pact verification', () => {
  it('vérifie le contrat Pact généré par le consumer', async () => {
    await new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: `http://localhost:${serverPort}`,
      pactUrls: [join(process.cwd(), 'pacts', 'splitto-frontend-splitto-api.json')],
      logLevel: 'warn',

      // State handlers : préparer la DB selon l'état attendu par le consumer
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await pool.query('TRUNCATE groups CASCADE');
          await pool.query(`INSERT INTO groups (id, name, currency) VALUES ('group-1', 'Test Group', 'EUR')`);
          await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('member-1', 'group-1', 'Alice', 'alice@test.com')`);
          await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('member-2', 'group-1', 'Bob', 'bob@test.com')`);
          await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('member-3', 'group-1', 'Carol', 'carol@test.com')`);
          await pool.query(`
            INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
            VALUES
              ('exp-1', 'group-1', 'Resto', 30, 'EUR', 'member-1', '2024-06-01T12:00:00Z', 'equal',
               '{"mode":"equal","beneficiaries":["member-1","member-2","member-3"]}', NOW()),
              ('exp-2', 'group-1', 'Taxi', 20, 'EUR', 'member-1', '2024-06-02T12:00:00Z', 'equal',
               '{"mode":"equal","beneficiaries":["member-1","member-2","member-3"]}', NOW())
          `);
        },
        'aucun groupe inexistant': async () => {
          await pool.query('TRUNCATE groups CASCADE');
        },
      },
    }).verifyProvider();
  }, 60_000);
});
