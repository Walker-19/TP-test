import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg, { type Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

const { Pool: PgPool } = pg;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: PgExpenseRepository;

// Setup 
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  pool = new PgPool({ connectionString: container.getConnectionUri() });

  //migration SQL
  const migration = await readFile(
    join(process.cwd(), 'migrations', '001-initial.sql'),
    'utf-8',
  );
  await pool.query(migration);

  // Insérer un groupe et un membre de base nécessaires aux FK
  await pool.query(`INSERT INTO groups (id, name, currency) VALUES ('group-1', 'Test Group', 'EUR')`);
  await pool.query(`INSERT INTO groups (id, name, currency) VALUES ('group-2', 'Other Group', 'EUR')`);
  await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('alice', 'group-1', 'Alice', 'alice@test.com')`);
  await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('bob', 'group-1', 'Bob', 'bob@test.com')`);
  await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('carol', 'group-2', 'Carol', 'carol@test.com')`);

  repo = new PgExpenseRepository(pool);
}, 60_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE expenses CASCADE');
});

//Helper 
function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    groupId: 'group-1',
    description: 'Resto',
    amount: 30,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2024-06-15T12:00:00Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    createdAt: new Date('2024-06-15T12:00:00Z'),
    ...overrides,
  };
}

//Tests 

describe('PgExpenseRepository', () => {

  // Test 1 : save puis findById retourne l'expense identique
  it('save() puis findById() retourne l\'expense avec les mêmes valeurs', async () => {
    const expense = makeExpense();
    await repo.save(expense);

    const found = await repo.findById('exp-1');

    expect(found).not.toBeNull();
    expect(found!.id).toBe(expense.id);
    expect(found!.groupId).toBe(expense.groupId);
    expect(found!.description).toBe(expense.description);
    expect(found!.amount).toBe(expense.amount);
    expect(found!.currency).toBe(expense.currency);
    expect(found!.paidBy).toBe(expense.paidBy);
    expect(found!.paidAt.toISOString()).toBe(expense.paidAt.toISOString());
    expect(found!.split).toEqual(expense.split);
  });

  // Test 2 : findByGroupId retourne uniquement les expenses du bon groupe
  it('findByGroupId() retourne uniquement les expenses du groupe demandé', async () => {
    await repo.save(makeExpense({ id: 'exp-1', groupId: 'group-1', paidAt: new Date('2024-06-01T12:00:00Z') }));
    await repo.save(makeExpense({ id: 'exp-2', groupId: 'group-1', paidAt: new Date('2024-06-02T12:00:00Z') }));
    await repo.save(makeExpense({ id: 'exp-3', groupId: 'group-2', paidBy: 'carol', paidAt: new Date('2024-06-03T12:00:00Z') }));

    const result = await repo.findByGroupId('group-1');

    expect(result).toHaveLength(2);
    expect(result.every((e) => e.groupId === 'group-1')).toBe(true);
  });

  // Test 3 : findInDateRange filtre correctement (inclusif sur les bornes)
  it('findInDateRange() filtre par date de façon inclusive', async () => {
    await repo.save(makeExpense({ id: 'exp-1', paidAt: new Date('2024-06-01T00:00:00Z') }));
    await repo.save(makeExpense({ id: 'exp-2', paidAt: new Date('2024-06-15T00:00:00Z') }));
    await repo.save(makeExpense({ id: 'exp-3', paidAt: new Date('2024-06-30T00:00:00Z') }));
    await repo.save(makeExpense({ id: 'exp-4', paidAt: new Date('2024-07-10T00:00:00Z') }));

    const result = await repo.findInDateRange(
      'group-1',
      new Date('2024-06-01T00:00:00Z'),
      new Date('2024-06-30T00:00:00Z'),
    );

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(
      expect.arrayContaining(['exp-1', 'exp-2', 'exp-3']),
    );
  });

  // Test 4 : contrainte UNIQUE rejette un doublon
  it('save() rejette un doublon (même group_id, paid_at, amount, paid_by)', async () => {
    const expense = makeExpense();
    await repo.save(expense);

    // Même expense avec un id différent mais même group_id + paid_at + amount + paid_by
    const duplicate = makeExpense({ id: 'exp-duplicate' });

    await expect(repo.save(duplicate)).rejects.toThrow();
  });

  // Test 5 : une transaction qui échoue rollback proprement
  it('une transaction qui échoue à mi-parcours ne sauvegarde aucune ligne', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
         VALUES ('exp-tx', 'group-1', 'Test', 10, 'EUR', 'alice', NOW(), 'equal', '{"mode":"equal","beneficiaries":["alice"]}', NOW())`,
      );
      // Forcer une erreur (clé dupliquée)
      await client.query(
        `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
         VALUES ('exp-tx', 'group-1', 'Test', 10, 'EUR', 'alice', NOW(), 'equal', '{"mode":"equal","beneficiaries":["alice"]}', NOW())`,
      );
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Aucune ligne ne doit avoir été sauvegardée
    const found = await repo.findById('exp-tx');
    expect(found).toBeNull();
  });
});
