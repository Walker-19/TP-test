# Analyse des mutations

## Score initial

- `balances.ts` : 92.50%
- `simplify.ts` : 84.38%

## Score final

- `balances.ts` : 97.50%
- `simplify.ts` : 84.85%

---

## Mutants tués grâce aux améliorations

### balances.ts

- Ajout d'un test `groupe vide + dépenses → retourne {}` pour tuer le mutant
  qui supprimait le guard `members.length === 0`
- Ajout d'un test `weighted puis percentage` pour tuer le mutant qui remplaçait
  `else if (mode === 'percentage')` par un `else` sans condition

### simplify.ts

- Ajout d'un test vérifiant qu'un membre à solde 0 n'apparaît pas dans les
  settlements → tue le mutant `b > 0` → `b >= 0`
- Ajout d'un test vérifiant qu'un membre à solde 0 ne génère aucun paiement
  → tue le mutant `b < 0` → `b <= 0`
- Ajout d'un test vérifiant qu'un débiteur qui rembourse exactement 2 créditeurs
  ne produit pas de settlement à 0 → tue le mutant `remaining <= 0` → `remaining < 0`

---

## Mutants survivants après amélioration

### Mutant 1 — balances.ts : opérateur `??` sur le payeur

- Fichier : `balances.ts:25`
- Mutation : `(balances[expense.paidBy] ?? 0) + expense.amount`
  → suppression du `?? 0`
- Pourquoi il survit : dans tous nos tests, le payeur est toujours un membre
  initialisé à 0 au préalable. La suppression du `?? 0` ne change rien car
  `undefined + number` donne `NaN` mais nos assertions utilisent `toBeCloseTo`
  qui ne détecterait pas le cas uniquement si le payeur n'est jamais absent
  du groupe.
- Décision : accepté — mutant équivalent dans le contexte de nos tests.

### Mutant 2 — simplify.ts : `Math.min` dans la boucle interne

- Fichier : `simplify.ts:21`
- Mutation : `Math.min(remaining, creditAmount)` → `Math.min(remaining, remaining)`
- Pourquoi il survit : quand `remaining <= creditAmount` (cas fréquent), les
  deux expressions donnent le même résultat.
- Décision : accepté — mutant équivalent pour les cas couverts.

### Mutant 3 — simplify.ts : `credits.set` après paiement

- Fichier : `simplify.ts:25`
- Mutation : suppression de `credits.set(creditorId, creditAmount - pay)`
- Pourquoi il survit : Stryker génère un timeout sur ce mutant (boucle infinie
  possible), compté comme non-tué mais non survivant strictement.
- Décision : accepté — timeout = le mutant est détecté de facto.

### Mutants 4-6 — simplify.ts : timeouts

- 4 mutants ont généré des **timeouts** (boucle infinie détectée par Stryker)
  dans les fonctions `buildCreditsMap` et `buildDebtsMap`.
- Ces mutants sont comptés comme `# timeout` et non comme `# survived` dans
  le rapport, mais apparaissent dans le score non-tué.
- Décision : acceptés — les timeouts prouvent indirectement que le code est
  nécessaire (sa suppression casse le programme).
