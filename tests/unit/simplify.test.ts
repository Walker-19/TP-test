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
});
