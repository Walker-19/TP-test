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
});
