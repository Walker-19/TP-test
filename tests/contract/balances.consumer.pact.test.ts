import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { join } from 'node:path';

const { like, regex } = MatchersV3;

// Pact consumer setup

const provider = new PactV3({
  consumer: 'splitto-frontend',
  provider: 'splitto-api',
  dir: join(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

// Tests consumer

describe('splitto-frontend → splitto-api (consumer pact)', () => {

  // Interaction 1 : groupe avec dépenses -> 200 avec balances
  it('GET /api/groups/group-1/balances retourne 200 avec les balances', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'group-1 a 3 membres et 2 dépenses' }],
        uponReceiving: 'une requête pour les balances du groupe group-1',
        withRequest: {
          method: 'GET',
          path: '/api/groups/group-1/balances',
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': regex('application/json.*', 'application/json') },
          body: {
            groupId: like('group-1'),
            balances: like({ 'member-1': 20, 'member-2': -10, 'member-3': -10 }),
            settlements: like([]),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/group-1/balances`);
        expect(res.status).toBe(200);
        const body = await res.json() as Record<string, unknown>;
        expect(body).toHaveProperty('groupId');
        expect(body).toHaveProperty('balances');
        expect(body).toHaveProperty('settlements');
      });
  });

  // Interaction 2 : groupe inexistant -> 404
  it('GET /api/groups/inexistant/balances retourne 404', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'aucun groupe inexistant' }],
        uponReceiving: 'une requête pour les balances d\'un groupe inexistant',
        withRequest: {
          method: 'GET',
          path: '/api/groups/inexistant/balances',
        },
        willRespondWith: {
          status: 404,
          headers: { 'Content-Type': regex('application/json.*', 'application/json') },
          body: {
            error: like('Group not found'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/inexistant/balances`);
        expect(res.status).toBe(404);
        const body = await res.json() as Record<string, unknown>;
        expect(body).toHaveProperty('error');
      });
  });
});
