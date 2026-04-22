#!/usr/bin/env node

require('dotenv').config();

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'password123';
const DEVICE_ID = process.env.SMOKE_DEVICE_ID || '44444444-4444-4444-4444-444444444444';
const DEVICE_TOKEN = process.env.SMOKE_DEVICE_TOKEN || 'smoke-test-device-token';
const AI_LABEL = process.env.SMOKE_AI_LABEL || 'cola_330ml';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const RUN_SESSION = process.env.SMOKE_RUN_SESSION !== 'false';
const RUN_SOCKET = process.env.SMOKE_RUN_SOCKET !== 'false';

const results = [];

function asJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const json = asJson(text);

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
    };
  } finally {
    clearTimeout(timer);
  }
}

function pass(name, detail) {
  results.push({ name, status: 'PASS', detail });
  console.log(`✅ PASS  ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`❌ FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
}

function skip(name, detail) {
  results.push({ name, status: 'SKIP', detail });
  console.log(`⏭️  SKIP  ${name}${detail ? ` - ${detail}` : ''}`);
}

async function runTest(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(name, error?.message || String(error));
  }
}

async function waitForDoorEvent(socket, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket door_event timeout')), timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      socket.off('door_event', onEvent);
      resolve(payload);
    };

    socket.on('door_event', onEvent);
  });
}

async function main() {
  console.log('--- Orvio Backend Smoke Test ---');
  console.log(`Base URL: ${BASE_URL}`);

  let token = null;
  let transactionId = null;

  await runTest('ST-01 API root health', async () => {
    const response = await request('/');
    if (!response.ok) throw new Error(`Expected 2xx, got ${response.status}`);
    pass('ST-01 API root health', `status=${response.status}`);
  });

  await runTest('ST-02 Unauthorized protected route', async () => {
    const response = await request('/auth/me');
    if (![401, 403].includes(response.status)) {
      throw new Error(`Expected 401/403, got ${response.status}`);
    }
    pass('ST-02 Unauthorized protected route', `status=${response.status}`);
  });

  await runTest('ST-03 Admin login', async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD');
    }

    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    });

    if (!response.ok || !response.json?.token) {
      throw new Error(`Login failed status=${response.status} body=${response.text}`);
    }

    token = response.json.token;
    pass('ST-03 Admin login', `status=${response.status}`);
  });

  await runTest('ST-04 Auth me', async () => {
    if (!token) throw new Error('Missing token from login step');

    const response = await request('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok || !response.json?.user_id) {
      throw new Error(`Expected authenticated user, got status=${response.status}`);
    }

    pass('ST-04 Auth me', `user_id=${response.json.user_id}`);
  });

  await runTest('ST-05 Dashboard summary', async () => {
    if (!token) throw new Error('Missing token from login step');

    const response = await request('/devices/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok || !response.json?.stats) {
      throw new Error(`Expected summary stats, got status=${response.status}`);
    }

    pass('ST-05 Dashboard summary', `status=${response.status}`);
  });

  await runTest('ST-06 Device list', async () => {
    if (!token) throw new Error('Missing token from login step');

    const response = await request('/devices?page=1&limit=5', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok || !Array.isArray(response.json?.data)) {
      throw new Error(`Expected paginated devices, got status=${response.status}`);
    }

    pass('ST-06 Device list', `count=${response.json.data.length}`);
  });

  if (!RUN_SESSION) {
    skip('ST-07~ST-11 Session/Realtime flow', 'SMOKE_RUN_SESSION=false');
  } else if (!DEVICE_ID) {
    skip('ST-07~ST-11 Session/Realtime flow', 'Set SMOKE_DEVICE_ID to run session/socket checks');
  } else {
    await runTest('ST-07 Start or reuse session', async () => {
      const startedAt = new Date().toISOString();

      const response = await request(`/devices/${DEVICE_ID}/sessions/start`, {
        method: 'POST',
        body: JSON.stringify({
          started_at: startedAt,
          transaction_type: 'SMOKE_TEST',
        }),
      });

      if (response.ok && response.json?.transaction_id) {
        transactionId = response.json.transaction_id;
        pass('ST-07 Start or reuse session', `transaction_id=${transactionId}`);
        return;
      }

      if (response.status === 409) {
        const current = await request(`/devices/${DEVICE_ID}/sessions/current`);
        if (current.ok && current.json?.transaction_id) {
          transactionId = current.json.transaction_id;
          pass('ST-07 Start or reuse session', `reused transaction_id=${transactionId}`);
          return;
        }
      }

      throw new Error(`Session start failed status=${response.status} body=${response.text}`);
    });

    await runTest('ST-08 Session current', async () => {
      const response = await request(`/devices/${DEVICE_ID}/sessions/current`);
      if (!response.ok || typeof response.json?.has_active_session !== 'boolean') {
        throw new Error(`Expected current session payload, got status=${response.status}`);
      }
      pass('ST-08 Session current', `has_active_session=${response.json.has_active_session}`);
    });

    await runTest('ST-09 Cart snapshot push (AI integration)', async () => {
      if (!transactionId) throw new Error('Missing transaction_id from session start');

      const response = await request(`/sessions/${transactionId}/cart`, {
        method: 'PUT',
        body: JSON.stringify({
          source: 'SMOKE_TEST',
          detected_at: new Date().toISOString(),
          items: [
            {
              ai_label: AI_LABEL,
              quantity: 1,
            },
          ],
        }),
      });

      if (!response.ok || !response.json?.transaction_id) {
        throw new Error(`Cart snapshot failed status=${response.status} body=${response.text}`);
      }

      pass('ST-09 Cart snapshot push (AI integration)', `transaction_id=${response.json.transaction_id}`);
    });

    await runTest('ST-10 Session heartbeat', async () => {
      if (!transactionId) throw new Error('Missing transaction_id from session start');

      const response = await request(`/devices/${DEVICE_ID}/sessions/${transactionId}/heartbeat`, {
        method: 'POST',
        headers: {
          'X-Device-Token': DEVICE_TOKEN,
        },
        body: JSON.stringify({
          heartbeat_at: new Date().toISOString(),
        }),
      });

      if (!response.ok || response.json?.alive !== true) {
        throw new Error(`Heartbeat failed status=${response.status} body=${response.text}`);
      }

      pass('ST-10 Session heartbeat', `last_activity=${response.json.last_activity}`);
    });

    if (!RUN_SOCKET) {
      skip('ST-11 Socket door_event broadcast', 'SMOKE_RUN_SOCKET=false');
    } else {
      await runTest('ST-11 Socket door_event broadcast', async () => {
        let io;
        try {
          ({ io } = require('socket.io-client'));
        } catch {
          throw new Error('socket.io-client not installed. Run: npm i -D socket.io-client');
        }

        const socket = io(BASE_URL, {
          transports: ['websocket'],
          timeout: TIMEOUT_MS,
        });

        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Socket connect timeout')), TIMEOUT_MS);
            socket.on('connect', () => {
              clearTimeout(timer);
              resolve();
            });
            socket.on('connect_error', (error) => {
              clearTimeout(timer);
              reject(error);
            });
          });

          socket.emit('join_cooler', DEVICE_ID);

          const waitEvent = waitForDoorEvent(socket, TIMEOUT_MS);

          const trigger = await request(`/devices/${DEVICE_ID}/door-event`, {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'OPEN',
              sessionId: transactionId || null,
            }),
          });

          if (!trigger.ok) {
            throw new Error(`Door event trigger failed status=${trigger.status} body=${trigger.text}`);
          }

          const payload = await waitEvent;
          if (!payload || payload.coolerId !== DEVICE_ID || payload.eventType !== 'OPEN') {
            throw new Error(`Unexpected socket payload: ${JSON.stringify(payload)}`);
          }

          pass('ST-11 Socket door_event broadcast', `eventType=${payload.eventType}`);
        } finally {
          socket.disconnect();
        }
      });
    }

    await runTest('ST-12 End session (cleanup)', async () => {
      if (!transactionId) {
        skip('ST-12 End session (cleanup)', 'No transaction_id to close');
        return;
      }

      const response = await request(`/devices/${DEVICE_ID}/sessions/${transactionId}/end`, {
        method: 'POST',
        body: JSON.stringify({
          ended_at: new Date().toISOString(),
          cancelled: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`End session failed status=${response.status} body=${response.text}`);
      }

      pass('ST-12 End session (cleanup)', `status=${response.status}`);
    });
  }

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const skipCount = results.filter((r) => r.status === 'SKIP').length;

  console.log('\n--- Smoke Test Summary ---');
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`SKIP: ${skipCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Smoke test fatal error:', error);
  process.exit(1);
});
