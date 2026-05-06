import { type Page, type Locator } from '@playwright/test';

export class GroupDetailPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openNewExpenseDialog() {
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).click();
  }

  async fillExpenseForm(description: string, amount: number, paidBy: string) {
    await this.page.getByLabel('Description').fill(description);
    await this.page.getByLabel('Montant').fill(String(amount));
    await this.page.getByLabel('Payé par').selectOption({ label: paidBy });
  }

  async submitExpenseForm() {
    await this.page.getByRole('dialog', { name: 'Ajouter une dépense' })
      .getByRole('button', { name: 'Ajouter' })
      .click();
  }

  expenseRow(description: string): Locator {
    return this.page.getByRole('table', { name: 'Liste des dépenses' })
      .getByRole('row').filter({ hasText: description });
  }

  balanceCell(memberId: string): Locator {
    return this.page.getByTestId(`balance-${memberId}`);
  }

  settlementRow(index: number): Locator {
    return this.page.getByTestId(`settlement-row-${index}`);
  }

  async settleSettlement(index: number) {
    await this.settlementRow(index).getByRole('button', { name: 'Régler' }).click();
  }
}
