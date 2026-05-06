// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const creditors = Object.entries(balances).filter(([, b]) => b > 0);
  const debtors = Object.entries(balances).filter(([, b]) => b < 0);

  const settlements: Settlement[] = [];

  for (const [debtorId, debtorBalance] of debtors) {
    let remaining = -debtorBalance;
    for (const [creditorId, creditorBalance] of creditors) {
      const pay = Math.min(remaining, creditorBalance);
      if (pay > 0) {
        settlements.push({ from: debtorId, to: creditorId, amount: pay });
        remaining -= pay;
      }
    }
  }

  return settlements;
}
