import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDatabase } from '@prompthub/db';

import { issueSolvedCaptcha } from '../test-helpers/auth-captcha';

const ENV_KEYS = [
  'PORT',
  'HOST',
  'JWT_SECRET',
  'JWT_ACCESS_TTL',
  'JWT_REFRESH_TTL',
  'DATA_ROOT',
  'ALLOW_REGISTRATION',
  'LOG_LEVEL',
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

async function createTestApp(dataDir: string) {
  Object.assign(process.env, {
    PORT: '3997',
    HOST: '127.0.0.1',
    JWT_SECRET: 'test-secret-for-web-prompt-advanced-1234567890',
    JWT_ACCESS_TTL: '900',
    JWT_REFRESH_TTL: '604800',
    DATA_ROOT: dataDir,
    ALLOW_REGISTRATION: 'true',
    LOG_LEVEL: 'debug',
  });

  const { createApp } = await import('../app');
  return createApp();
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function registerUser(app: Awaited<ReturnType<typeof createTestApp>>, username: string) {
  const captcha = await issueSolvedCaptcha(app);
  const response = await app.request(
    new Request('http://local/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'debugpass001', ...captcha }),
    }),
  );
  const payload = (await response.json()) as {
    data: { accessToken: string; user: { id: string; role: 'admin' | 'user' } };
  };
  return payload.data;
}

async function createPrompt(app: Awaited<ReturnType<typeof createTestApp>>, token: string, title: string) {
  const response = await app.request(
    new Request('http://local/api/prompts', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ title, userPrompt: `${title} content` }),
    }),
  );
  const payload = (await response.json()) as { data: { id: string } };
  expect(response.status).toBe(201);
  return payload.data.id;
}

describe('web advanced prompt routes', () => {
  const TEST_TIMEOUT = 20_000;
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    closeDatabase();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('persists hierarchy moves and rejects inaccessible or cyclic parents', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompthub-web-prompt-advanced-'));
    tempDirs.push(dataDir);
    const app = await createTestApp(dataDir);
    const owner = await registerUser(app, 'advanced-owner');
    const other = await registerUser(app, 'advanced-other');
    const parentId = await createPrompt(app, owner.accessToken, 'Parent');
    const childId = await createPrompt(app, owner.accessToken, 'Child');
    const privateOtherId = await createPrompt(app, other.accessToken, 'Other parent');

    const moveResponse = await app.request(
      new Request(`http://local/api/prompts/${childId}/move`, {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ parentId, sortOrder: 0 }),
      }),
    );
    expect(moveResponse.status).toBe(200);
    expect((await moveResponse.json()).data.parentId).toBe(parentId);

    const cycleResponse = await app.request(
      new Request(`http://local/api/prompts/${parentId}/move`, {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ parentId: childId, sortOrder: 0 }),
      }),
    );
    expect(cycleResponse.status).toBe(422);

    const moveToRootResponse = await app.request(
      new Request(`http://local/api/prompts/${childId}/move`, {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ parentId: null, sortOrder: 0 }),
      }),
    );
    expect(moveToRootResponse.status).toBe(200);
    expect((await moveToRootResponse.json()).data.parentId).toBeNull();

    const inaccessibleResponse = await app.request(
      new Request(`http://local/api/prompts/${childId}/move`, {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ parentId: privateOtherId, sortOrder: 0 }),
      }),
    );
    expect(inaccessibleResponse.status).toBe(404);
  }, TEST_TIMEOUT);

  it('manages prompt relations through the authorized Web contract', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompthub-web-prompt-advanced-'));
    tempDirs.push(dataDir);
    const app = await createTestApp(dataDir);
    const owner = await registerUser(app, 'relation-owner');
    const sourcePromptId = await createPrompt(app, owner.accessToken, 'Relation source');
    const targetPromptId = await createPrompt(app, owner.accessToken, 'Relation target');

    const createResponse = await app.request(
      new Request('http://local/api/prompts/relations', {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({
          sourcePromptId,
          targetPromptId,
          kind: 'depends_on',
          note: 'required first',
        }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const relation = (await createResponse.json()).data as { id: string };

    const listResponse = await app.request(
      new Request(`http://local/api/prompts/relations?promptId=${encodeURIComponent(sourcePromptId)}`, {
        headers: authHeaders(owner.accessToken),
      }),
    );
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data).toEqual([
      expect.objectContaining({ id: relation.id, note: 'required first' }),
    ]);

    const updateResponse = await app.request(
      new Request(`http://local/api/prompts/relations/${relation.id}`, {
        method: 'PUT',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ note: 'updated note' }),
      }),
    );
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()).data.note).toBe('updated note');

    const deleteResponse = await app.request(
      new Request(`http://local/api/prompts/relations/${relation.id}`, {
        method: 'DELETE',
        headers: authHeaders(owner.accessToken),
      }),
    );
    expect(deleteResponse.status).toBe(200);
  }, TEST_TIMEOUT);

  it('persists output-format ordering and rejects inaccessible targets', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompthub-web-prompt-advanced-'));
    tempDirs.push(dataDir);
    const app = await createTestApp(dataDir);
    const owner = await registerUser(app, 'format-owner');
    const other = await registerUser(app, 'format-other');
    const sourcePromptId = await createPrompt(app, owner.accessToken, 'Format source');
    const targetPromptId = await createPrompt(app, owner.accessToken, 'Format target');
    const inaccessibleTargetId = await createPrompt(app, other.accessToken, 'Private target');

    const createResponse = await app.request(
      new Request('http://local/api/prompts/output-formats', {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ sourcePromptId, targetPromptId, sortOrder: 0 }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const item = (await createResponse.json()).data as { id: string };

    const reorderResponse = await app.request(
      new Request(`http://local/api/prompts/output-formats/${item.id}/reorder`, {
        method: 'PUT',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ sourcePromptId, sortOrder: 1 }),
      }),
    );
    expect(reorderResponse.status).toBe(200);

    const listResponse = await app.request(
      new Request(`http://local/api/prompts/output-formats?sourcePromptId=${encodeURIComponent(sourcePromptId)}`, {
        headers: authHeaders(owner.accessToken),
      }),
    );
    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data).toEqual([expect.objectContaining({ id: item.id, sortOrder: 1 })]);

    const updateResponse = await app.request(
      new Request(`http://local/api/prompts/output-formats/${item.id}`, {
        method: 'PUT',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({ sortOrder: 0 }),
      }),
    );
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()).data.sortOrder).toBe(0);

    const inaccessibleResponse = await app.request(
      new Request('http://local/api/prompts/output-formats', {
        method: 'POST',
        headers: authHeaders(owner.accessToken),
        body: JSON.stringify({
          sourcePromptId,
          targetPromptId: inaccessibleTargetId,
        }),
      }),
    );
    expect(inaccessibleResponse.status).toBe(404);

    const deleteResponse = await app.request(
      new Request(`http://local/api/prompts/output-formats/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(owner.accessToken),
      }),
    );
    expect(deleteResponse.status).toBe(200);

    const afterDeleteResponse = await app.request(
      new Request(`http://local/api/prompts/output-formats?sourcePromptId=${encodeURIComponent(sourcePromptId)}`, {
        headers: authHeaders(owner.accessToken),
      }),
    );
    expect((await afterDeleteResponse.json()).data).toEqual([]);
  }, TEST_TIMEOUT);
});
