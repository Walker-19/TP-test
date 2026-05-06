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
  // Soldes mutables pour pouvoir les réduire au fil des règlements
  const credits = new Map<string, number>(
    Object.entries(balances).filter(([, b]) => b > 0),
  );
  const debts = new Map<string, number>(
    Object.entries(balances).filter(([, b]) => b < 0).map(([id, b]) => [id, -b]),
  );

  const settlements: Settlement[] = [];

  for (const [debtorId, debtAmount] of debts) {
    let remaining = debtAmount;
    for (const [creditorId, creditAmount] of credits) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, creditAmount);
      if (pay <= 0) continue;
      settlements.push({ from: debtorId, to: creditorId, amount: pay });
      remaining -= pay;
      credits.set(creditorId, creditAmount - pay);
    }
  }

  return settlements;
}
