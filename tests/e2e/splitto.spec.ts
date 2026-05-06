import { test, expect } from '@playwright/test';
import { GroupsPage } from './pages/groups.page';
import { GroupDetailPage } from './pages/group-detail.page';

// Isolation totale : reset la DB avant chaque test
test.beforeEach(async ({ request: req }) => {
  await req.post('/_test/reset');
});

// Scénario 1 : Créer un groupe avec 3 membres 
test('créer un groupe avec 3 membres', async ({ page }) => {
  const groupsPage = new GroupsPage(page);
  await groupsPage.goto();

  await groupsPage.openNewGroupDialog();
  await groupsPage.fillGroupForm('Voyage Rome', [
    'Alice <alice@test.com>',
    'Bob <bob@test.com>',
    'Carol <carol@test.com>',
  ]);
  await groupsPage.submitGroupForm();

  // Le groupe apparaît dans la liste
  await expect(groupsPage.groupCard('Voyage Rome')).toBeVisible();
});

// Scénario 2 : Ajouter une dépense 
test('ajouter une dépense dans un groupe', async ({ page }) => {
  const groupsPage = new GroupsPage(page);
  const detailPage = new GroupDetailPage(page);

  await groupsPage.goto();

  // Créer un groupe d'abord
  await groupsPage.openNewGroupDialog();
  await groupsPage.fillGroupForm('Coloc', [
    'Alice <alice@test.com>',
    'Bob <bob@test.com>',
  ]);
  await groupsPage.submitGroupForm();

  // Ouvrir le groupe
  await groupsPage.clickGroup('Coloc');

  // Ajouter une dépense
  await detailPage.openNewExpenseDialog();
  await detailPage.fillExpenseForm('Courses', 40, 'Alice');
  await detailPage.submitExpenseForm();

  // La dépense apparaît dans la liste
  await expect(detailPage.expenseRow('Courses')).toBeVisible();
});

// Scénario 3 : Voir les soldes mis à jour 
test('les soldes sont corrects après une dépense de 30€ payée par Alice pour 3', async ({ page }) => {
  const groupsPage = new GroupsPage(page);
  const detailPage = new GroupDetailPage(page);

  await groupsPage.goto();

  // Créer un groupe avec 3 membres
  await groupsPage.openNewGroupDialog();
  await groupsPage.fillGroupForm('Amis', [
    'Alice <alice@test.com>',
    'Bob <bob@test.com>',
    'Carol <carol@test.com>',
  ]);
  await groupsPage.submitGroupForm();
  await groupsPage.clickGroup('Amis');

  // Ajouter une dépense de 30€ payée par Alice (tous bénéficiaires par défaut)
  await detailPage.openNewExpenseDialog();
  await detailPage.fillExpenseForm('Resto', 30, 'Alice');
  await detailPage.submitExpenseForm();

  // Recharger les balances (la page se met à jour automatiquement)
  // Récupérer les IDs des membres depuis les data-testid
  // Alice créditrice de 20€
  await expect(page.getByRole('table', { name: 'Soldes des membres' })
    .getByRole('row').filter({ hasText: 'Alice' })).toContainText('20.00');

  // Bob débiteur de 10€
  await expect(page.getByRole('table', { name: 'Soldes des membres' })
    .getByRole('row').filter({ hasText: 'Bob' })).toContainText('-10.00');

  // Carol débitrice de 10€
  await expect(page.getByRole('table', { name: 'Soldes des membres' })
    .getByRole('row').filter({ hasText: 'Carol' })).toContainText('-10.00');
});

// Scénario 4 : Marquer un règlement comme réglé
test('marquer un règlement comme réglé le fait disparaître', async ({ page }) => {
  const groupsPage = new GroupsPage(page);
  const detailPage = new GroupDetailPage(page);

  await groupsPage.goto();

  // Créer groupe + dépense pour avoir un settlement
  await groupsPage.openNewGroupDialog();
  await groupsPage.fillGroupForm('Trip', [
    'Alice <alice@test.com>',
    'Bob <bob@test.com>',
  ]);
  await groupsPage.submitGroupForm();
  await groupsPage.clickGroup('Trip');

  await detailPage.openNewExpenseDialog();
  await detailPage.fillExpenseForm('Hotel', 100, 'Alice');
  await detailPage.submitExpenseForm();

  // Un settlement doit apparaître
  await expect(detailPage.settlementRow(0)).toBeVisible();

  // Cliquer sur Régler
  await detailPage.settleSettlement(0);

  // Le settlement disparaît
  await expect(detailPage.settlementRow(0)).not.toBeVisible();
});
