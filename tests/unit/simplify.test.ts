import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('2 personnes : le débiteur rembourse le créditeur', () => {
    const result = simplifyDebts({ a: 10, b: -10 });
    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });
});
