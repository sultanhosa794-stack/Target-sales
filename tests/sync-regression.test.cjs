const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadBackend(fetch) {
  const storage = new Map([['target_sales_device_identity_v1', 'test-device']]);
  const module = { exports: {} };
  const mocks = {
    'expo-secure-store': {
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value) => storage.set(key, value),
      deleteItemAsync: async key => storage.delete(key),
    },
    'expo-application': {},
    'react-native': { Platform: { OS: 'android' } },
  };
  const source = ts.transpileModule(fs.readFileSync('lib/backend.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: name => {
      assert.ok(name in mocks, `Unexpected native import: ${name}`);
      return mocks[name];
    }, fetch, Headers, Response, console, Date, Intl,
  });
  return { backend: module.exports, storage };
}

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const savedSession = { access_token: 'old-token', refresh_token: 'refresh-token', expires_at: 9999999999 };

test('login returns the profile used for role routing and persists the session', async () => {
  for (const role of ['employee', 'system_admin', 'manager', 'viewer']) {
    const profile = { id: 'user-id', full_name: 'Test', username: 'test', role };
    const { backend } = loadBackend(async (url, init) => {
      assert.ok(url.endsWith('/functions/v1/login-bootstrap'));
      const body = JSON.parse(init.body);
      assert.equal(body.username, 'test');
      assert.equal(body.device_token, 'test-device');
      return json({ profile, session: savedSession });
    });
    const result = await backend.login(' test ', '123456');
    assert.equal(result.role, role);
    assert.equal((await backend.getStoredProfile()).id, profile.id);
    assert.equal((await backend.ensureSession()).refresh_token, savedSession.refresh_token);
  }
});

test('temporary refresh failure retains the stored login for another attempt', async () => {
  let available = false;
  const { backend, storage } = loadBackend(async () => available
    ? json({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 })
    : json({ error: 'temporary_failure' }, 503));
  storage.set('target_sales_session_v1', JSON.stringify({ ...savedSession, expires_at: 1 }));
  storage.set('target_sales_profile_v1', JSON.stringify({ id: 'user-id', role: 'employee' }));
  await assert.rejects(backend.ensureSession(), /حسابك ما زال مسجلًا/);
  assert.equal((await backend.getStoredSession()).refresh_token, 'refresh-token');
  assert.equal((await backend.getStoredProfile()).id, 'user-id');
  available = true;
  assert.equal((await backend.ensureSession()).access_token, 'new-token');
});

test('device-change login rejection does not overwrite an existing session', async () => {
  const { backend, storage } = loadBackend(async () => json({ error: 'device_change_required' }, 403));
  storage.set('target_sales_session_v1', JSON.stringify(savedSession));
  await assert.rejects(backend.login('test', '123456'), /DEVICE_CHANGE_REQUIRED/);
  assert.equal((await backend.getStoredSession()).access_token, 'old-token');
});

test('sales report refreshes once, retries with the new token, and returns the report', async () => {
  let reports = 0, refreshes = 0;
  const { backend, storage } = loadBackend(async (url, init) => {
    if (url.includes('/auth/v1/token')) {
      refreshes++;
      return json({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
    }
    reports++;
    assert.equal(JSON.parse(init.body).date, '2026-10-15');
    if (reports === 1) return json({ message: 'expired' }, 401);
    assert.equal(init.headers.Authorization, 'Bearer new-token');
    return json({ date: '2026-10-15', rows: [], total_units: 0 });
  });
  storage.set('target_sales_session_v1', JSON.stringify(savedSession));
  assert.equal((await backend.fetchDailySalesReport('2026-10-15')).total_units, 0);
  assert.equal(reports, 2);
  assert.equal(refreshes, 1);
});

test('persistent report authorization failure stops after one retry', async () => {
  let reports = 0, refreshes = 0;
  const { backend, storage } = loadBackend(async url => {
    if (url.includes('/auth/v1/token')) {
      refreshes++;
      assert.ok(refreshes <= 1, 'must not repeatedly rotate refresh tokens');
      return json({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 });
    }
    reports++;
    assert.ok(reports <= 2, 'must not recursively retry the report');
    return json({ message: 'not_allowed' }, 401);
  });
  storage.set('target_sales_session_v1', JSON.stringify(savedSession));
  await assert.rejects(backend.fetchDailySalesReport('2026-10-15'), /ليس لديك صلاحية/);
  assert.equal(reports, 2);
  assert.equal(refreshes, 1);
});

test('business date changes at 02:00 in Riyadh', () => {
  const { backend } = loadBackend(async () => { throw new Error('unexpected network'); });
  assert.equal(backend.businessDate(new Date('2026-10-15T22:59:59Z')), '2026-10-15');
  assert.equal(backend.businessDate(new Date('2026-10-15T23:00:00Z')), '2026-10-16');
});
