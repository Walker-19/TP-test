import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense } from '../../src/domain/types';


function makeGroup(memberNames: string[]): Group {
  return {
    id: 'group-1',
    name: 'Test Group',
    currency: 'EUR',
    members: memberNames.map((name) => ({ id: name, name, email: `${name}@test.com` })),
  };
}

function makeExpense(overrides: Partial<Expense> & Pick<Expense, 'amount' | 'paidBy' | 'split'>): Expense {
  return {
    id: 'exp-1',
    groupId: 'group-1',
    description: 'Test expense',
    currency: 'EUR',
    paidAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}


//Cas obligatoires 
describe('computeBalances', () => {
  // Cas 1 : Groupe vide
  it('retourne un objet vide si le groupe n\'a aucun membre', () => {
    const group = makeGroup([]);
    const result = computeBalances(group, []);
    expect(result).toEqual({});
  });

  // Cas 2 : Dépense equal, le payeur EST bénéficiaire
  it('dépense equal entre 3 personnes, le payeur est inclus comme bénéficiaire', () => {
    const group = makeGroup(['alice', 'bob', 'carol']);
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'carol'] },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(20);   // +30 payé - 10 quote-part
    expect(result.bob).toBeCloseTo(-10);
    expect(result.carol).toBeCloseTo(-10);
  });

  // Cas 3 : Dépense equal, le payeur N'EST PAS bénéficiaire
  it('dépense equal entre 3 personnes, le payeur n\'est PAS bénéficiaire', () => {
    const group = makeGroup(['alice', 'bob', 'carol']);
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['bob', 'carol', 'dave'] },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(30);   // a payé, rien à rembourser
    expect(result.bob).toBeCloseTo(-10);
    expect(result.carol).toBeCloseTo(-10);
  });

  // Cas 4 : Plusieurs dépenses qui se compensent partiellement
  it('plusieurs dépenses qui se compensent partiellement', () => {
    const group = makeGroup(['alice', 'bob']);

    const expense1 = makeExpense({
      id: 'exp-1',
      amount: 60,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    });
    const expense2 = makeExpense({
      id: 'exp-2',
      amount: 40,
      paidBy: 'bob',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    });

    const result = computeBalances(group, [expense1, expense2]);

    expect(result.alice).toBeCloseTo(10);
    expect(result.bob).toBeCloseTo(-10);
  });

  // Cas 5 : Dépense weighted avec poids non-uniformes
  it('dépense weighted avec poids non-uniformes', () => {
    const group = makeGroup(['alice', 'bob', 'carol']);
    const expense = makeExpense({
      amount: 60,
      paidBy: 'alice',
      split: { mode: 'weighted', weights: { alice: 1, bob: 2, carol: 3 } },
    });

    const result = computeBalances(group, [expense]);

    
    expect(result.alice).toBeCloseTo(50);
    expect(result.bob).toBeCloseTo(-20);
    expect(result.carol).toBeCloseTo(-30);
  });

  // Cas 6 : Dépense percentage avec arrondis (100€ entre 3)
  it('dépense percentage avec arrondis (100€ entre 3 = 33.33 + 33.33 + 33.34)', () => {
    const group = makeGroup(['alice', 'bob', 'carol']);
    const expense = makeExpense({
      amount: 100,
      paidBy: 'alice',
      // percentages intentionnellement non-ronds
      split: { mode: 'percentage', percentages: { alice: 33.33, bob: 33.33, carol: 33.34 } },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(66.67, 1);
    expect(result.bob).toBeCloseTo(-33.33, 1);
    expect(result.carol).toBeCloseTo(-33.34, 1);

    // La somme des soldes doit être ≈ 0
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(0, 2);
  });

  //Cas limites 
  // Limite 1 : Liste vide de dépenses
  it('retourne des soldes à 0 si la liste de dépenses est vide', () => {
    const group = makeGroup(['alice', 'bob', 'carol']);
    const result = computeBalances(group, []);

    expect(result).toEqual({ alice: 0, bob: 0, carol: 0 });
  });

  // Limite 2 : Dépense avec un seul bénéficiaire (le payeur lui-même)
  it('dépense où le payeur est le seul bénéficiaire → solde net = 0', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      amount: 50,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice'] },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(0);
    expect(result.bob).toBeCloseTo(0);
  });

  // Limite 3 : Membre supprimé qui figure dans une vieille dépense
  it('un bénéficiaire absent du groupe (membre supprimé) reçoit quand même un solde', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'dave'] },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(20);
    expect(result.bob).toBeCloseTo(-10);
    // dave n'est pas dans le groupe, mais sa dette est bien calculée
    expect(result.dave).toBeCloseTo(-10);
  });

  // Limite 4 : Très grand nombre de membres (10+)
  it('fonctionne avec 12 membres', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `member-${i}`);
    const group = makeGroup(ids);
    const expense = makeExpense({
      amount: 120,
      paidBy: 'member-0',
      split: { mode: 'equal', beneficiaries: ids },
    });

    const result = computeBalances(group, [expense]);

    expect(result['member-0']).toBeCloseTo(110);
    for (let i = 1; i < ids.length; i++) {
      expect(result[ids[i]]).toBeCloseTo(-10);
    }
  });

  // Limite 5 : Dépense de 0€ (autorisée, soldes inchangés)
  it('dépense de 0€ est autorisée et ne modifie pas les soldes', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      amount: 0,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    });

    const result = computeBalances(group, [expense]);

    expect(result.alice).toBeCloseTo(0);
    expect(result.bob).toBeCloseTo(0);
  });

  // Mutant killer 1 : groupe vide AVEC des dépenses → résultat vide
  // (tue le mutant qui supprime le guard `members.length === 0`)
  it('groupe vide avec une dépense → retourne {}', () => {
    const group = makeGroup([]);
    const expense = makeExpense({
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice'] },
    });

    const result = computeBalances(group, [expense]);

    // Le guard doit bloquer l'exécution et retourner {}
    expect(result).toEqual({});
  });

  // Mutant killer 2 : une dépense weighted suivie d'une dépense percentage
  // (tue le mutant qui change `else if (mode === 'percentage')` en `else`)
  it('dépense weighted puis percentage traitées indépendamment', () => {
    const group = makeGroup(['alice', 'bob']);
    const expenseW = makeExpense({
      id: 'exp-w',
      amount: 100,
      paidBy: 'alice',
      split: { mode: 'weighted', weights: { alice: 1, bob: 1 } },
    });
    const expenseP = makeExpense({
      id: 'exp-p',
      amount: 200,
      paidBy: 'bob',
      split: { mode: 'percentage', percentages: { alice: 25, bob: 75 } },
    });

    const result = computeBalances(group, [expenseW, expenseP]);

    // alice: +100 -50 (weighted) -50 (25% de 200) = 0
    expect(result.alice).toBeCloseTo(0);
    // bob: -50 (weighted) +200 -150 (75% de 200) = 0
    expect(result.bob).toBeCloseTo(0);
  });
});
