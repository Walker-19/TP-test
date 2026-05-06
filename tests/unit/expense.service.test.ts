import { describe, it, expect, vi } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';

// DUMMY 
const dummyLogger: Logger = {
  info: () => {},
  error: () => {},
};

// STUB 
const stubClock: Clock = {
  now: () => new Date('2024-06-01T12:00:00Z'),
};

const stubIdGen: IdGenerator = {
  next: () => 'expense-id-42',
};

// FAKE 
class FakeExpenseRepository implements ExpenseRepository {
  private readonly store = new Map<string, Expense>();

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.store.get(id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return [...this.store.values()].filter((e) => e.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.groupId === groupId && e.paidAt >= from && e.paidAt <= to,
    );
  }
}

// SPY 
const spyNotifier: EmailNotifier = {
  notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
};

// MOCK
const mockNotifier: EmailNotifier = {
  notifyGroupMembers: vi.fn().mockResolvedValue(undefined),
};

// Data de base pour les tests
const baseInput: CreateExpenseInput = {
  groupId: 'group-1',
  description: 'Resto',
  amount: 30,
  currency: 'EUR',
  paidBy: 'alice',
  paidAt: new Date('2024-06-01'),
  split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
};

// Tests 
describe('ExpenseService.create()', () => {
  it("l'expense retourné a les bonnes valeurs (id et createdAt injectés)", async () => {
    const repo = new FakeExpenseRepository();
    const service = new ExpenseService(repo, spyNotifier, stubClock, stubIdGen, dummyLogger);

    const result = await service.create(baseInput);

    expect(result.id).toBe('expense-id-42');
    expect(result.createdAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(result.description).toBe('Resto');
    expect(result.amount).toBe(30);
  });

  it('le repository contient bien l\'expense après save (via Fake)', async () => {
    const repo = new FakeExpenseRepository();
    const service = new ExpenseService(repo, spyNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create(baseInput);

    const saved = await repo.findById('expense-id-42');
    expect(saved).not.toBeNull();
    expect(saved?.description).toBe('Resto');
  });

  it('le notifier EST appelé si amount >= 100 (vérifié avec le Spy)', async () => {
    const repo = new FakeExpenseRepository();
    const spy = { notifyGroupMembers: vi.fn().mockResolvedValue(undefined) };
    const service = new ExpenseService(repo, spy, stubClock, stubIdGen, dummyLogger);

    await service.create({ ...baseInput, amount: 150 });

    expect(spy.notifyGroupMembers).toHaveBeenCalledOnce();
    expect(spy.notifyGroupMembers).toHaveBeenCalledWith(
      'group-1',
      expect.stringContaining('Resto'),
    );
  });

  it('le notifier N\'EST PAS appelé si amount < 100 (vérifié avec le Mock)', async () => {
    const repo = new FakeExpenseRepository();
    // Mock : on vérifie explicitement qu'il ne doit PAS être appelé
    const mock = { notifyGroupMembers: vi.fn().mockResolvedValue(undefined) };
    const service = new ExpenseService(repo, mock, stubClock, stubIdGen, dummyLogger);

    await service.create({ ...baseInput, amount: 30 });

    expect(mock.notifyGroupMembers).not.toHaveBeenCalled();
  });

  it('le notifier EST appelé exactement pour amount === 100 (limite)', async () => {
    const repo = new FakeExpenseRepository();
    const spy = { notifyGroupMembers: vi.fn().mockResolvedValue(undefined) };
    const service = new ExpenseService(repo, spy, stubClock, stubIdGen, dummyLogger);

    await service.create({ ...baseInput, amount: 100 });

    expect(spy.notifyGroupMembers).toHaveBeenCalledOnce();
  });
});
