import { type Page, type Locator } from '@playwright/test';

export class GroupsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  async openNewGroupDialog() {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
  }

  async fillGroupForm(name: string, members: string[]) {
    await this.page.getByLabel('Nom du groupe').fill(name);
    await this.page.getByLabel(/Membres/).fill(members.join('\n'));
  }

  async submitGroupForm() {
    await this.page.getByRole('dialog', { name: 'Créer un groupe' })
      .getByRole('button', { name: 'Créer' })
      .click();
  }

  async clickGroup(name: string) {
    await this.page.getByRole('listitem').filter({ hasText: name }).click();
  }

  groupCard(name: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: name });
  }
}
