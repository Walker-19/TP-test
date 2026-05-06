import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('2 personnes : le débiteur rembourse le créditeur', () => {
    const result = simplifyDebts({ a: 10, b: -10 });
    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('tous les soldes sont à 0 → aucun règlement', () => {
    const result = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(result).toEqual([]);
  });

  it('3 personnes en triangle : 1 seul settlement, pas de détour par b', () => {
    const result = simplifyDebts({ a: 10, b: 0, c: -10 });
    expect(result).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
  });

  it('4 personnes circulaire : 2 settlements minimum, pas 3', () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from: 'b', to: 'a', amount: 20 });
    expect(result).toContainEqual({ from: 'c', to: 'a', amount: 10 });
  });

  it('2 créditeurs 2 débiteurs : nombre minimum de settlements', () => {
    // a doit recevoir 10, b doit recevoir 20
    // c doit payer 10, d doit payer 20
    // minimum = 2 settlements : c→a:10, d→b:20
    const result = simplifyDebts({ a: 10, b: 20, c: -10, d: -20 });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from: 'c', to: 'a', amount: 10 });
    expect(result).toContainEqual({ from: 'd', to: 'b', amount: 20 });
  });

  // Mutant killer : b > 0 ne doit pas inclure les membres à solde 0 comme créditeurs
  // (tue le mutant b > 0 → b >= 0)
  it('un membre à solde 0 n\'est pas impliqué dans les settlements', () => {
    const result = simplifyDebts({ a: 10, b: 0, c: -10 });
    const involvedIds = result.flatMap((s) => [s.from, s.to]);
    expect(involvedIds).not.toContain('b');
  });

  // Mutant killer : b < 0 ne doit pas inclure les membres à solde 0 comme débiteurs
  // (tue le mutant b < 0 → b <= 0)
  it('un membre à solde exactement 0 ne génère aucun paiement', () => {
    const result = simplifyDebts({ a: 5, b: 0, c: -5 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'c', to: 'a', amount: 5 });
  });

  // Mutant killer : remaining <= 0 doit stopper quand remaining === 0
  // (tue le mutant <= → <)
  it('un débiteur qui rembourse exactement 2 créditeurs ne génère pas de settlement à 0', () => {
    // c doit 30 : 20 à a et 10 à b
    const result = simplifyDebts({ a: 20, b: 10, c: -30 });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.amount > 0)).toBe(true);
    expect(result).toContainEqual({ from: 'c', to: 'a', amount: 20 });
    expect(result).toContainEqual({ from: 'c', to: 'b', amount: 10 });
  });
});
