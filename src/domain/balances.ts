// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {

    if(group.members.length === 0) {
        return {}; // solde à 0
    }
  
  const balances: Balances = {};

  for (const member of group.members) {
    balances[member.id] = 0;
  }
   
  for (const expense of expenses) {
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.amount;

    if (expense.split.mode === 'equal') {
      const share = expense.amount / expense.split.beneficiaries.length;
      for (const memberId of expense.split.beneficiaries) {
        balances[memberId] = (balances[memberId] ?? 0) - share;
      }
    } else if (expense.split.mode === 'weighted') {
      const totalWeight = Object.values(expense.split.weights).reduce((a, b) => a + b, 0);
      for (const [memberId, weight] of Object.entries(expense.split.weights)) {
        balances[memberId] = (balances[memberId] ?? 0) - (weight / totalWeight) * expense.amount;
      }
    } else if (expense.split.mode === 'percentage') {
      for (const [memberId, pct] of Object.entries(expense.split.percentages)) {
        balances[memberId] = (balances[memberId] ?? 0) - (pct / 100) * expense.amount;
      }
    }
  }
  return balances;
}
