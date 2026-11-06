import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to make HTTPS requests
function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// 1. Environment & Config Verification
test('Environment variables are properly formatted in .env', () => {
  const envPath = path.resolve(__dirname, '../.env');
  assert.ok(fs.existsSync(envPath), '.env file must exist');

  const content = fs.readFileSync(envPath, 'utf8');
  const requiredKeys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  for (const key of requiredKeys) {
    const match = content.match(new RegExp(`^${key}=(.+)`, 'm'));
    assert.ok(match, `${key} must be defined in .env`);
    assert.ok(match[1].trim().length > 0, `${key} must not be empty`);
  }
});

// 2. Deterministic Chat ID Generation
test('Deterministic Chat ID is consistent regardless of order', () => {
  const userA = 'user_alpha_123';
  const userB = 'user_beta_456';

  const chatId1 = [userA, userB].sort().join('_');
  const chatId2 = [userB, userA].sort().join('_');

  assert.equal(chatId1, chatId2);
  assert.equal(chatId1, 'user_alpha_123_user_beta_456');
});

// 3. Time Divider Logic
test('Time divider returns true for messages > 10 minutes apart', () => {
  const shouldShowTimeDivider = (prevMsg, currentMsg) => {
    if (!prevMsg || !prevMsg.timestamp || !currentMsg.timestamp) return true;
    const prevTime = prevMsg.timestamp;
    const currentTime = currentMsg.timestamp;
    const diffInMinutes = Math.abs((currentTime - prevTime) / 60000);
    return diffInMinutes > 10;
  };

  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const fifteenMinutesAgo = now - 15 * 60 * 1000;

  assert.equal(
    shouldShowTimeDivider({ timestamp: fiveMinutesAgo }, { timestamp: now }),
    false,
    '5 mins apart should NOT show divider'
  );

  assert.equal(
    shouldShowTimeDivider({ timestamp: fifteenMinutesAgo }, { timestamp: now }),
    true,
    '15 mins apart SHOULD show divider'
  );

  assert.equal(shouldShowTimeDivider(null, { timestamp: now }), true, 'First message should show divider');
});

// 4. Notification Suppression Logic
test('Notification duplicate suppression handles auto-login and regular logins', () => {
  const shouldSuppress = (lastMsg, nextMsg) => {
    if (lastMsg === 'Auto Login Successful!' && nextMsg === 'Auto Login Successful!') return true;
    if ((lastMsg === 'Login successful!' || lastMsg === 'Google login successful!') && nextMsg === 'Auto Login Successful!') return true;
    return false;
  };

  assert.ok(shouldSuppress('Login successful!', 'Auto Login Successful!'));
  assert.ok(shouldSuppress('Google login successful!', 'Auto Login Successful!'));
  assert.ok(shouldSuppress('Auto Login Successful!', 'Auto Login Successful!'));
  assert.ok(!shouldSuppress('Friend request accepted!', 'Auto Login Successful!'));
  assert.ok(!shouldSuppress(null, 'Login successful!'));
});

// 5. Firebase Live Auth & Firestore Integration Test
test('Firebase Auth and Firestore services are reachable and functional', async () => {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  const getEnv = (key) => envContent.match(new RegExp(`^${key}=(.+)`, 'm'))?.[1]?.trim();

  const apiKey = getEnv('VITE_FIREBASE_API_KEY');
  const projectId = getEnv('VITE_FIREBASE_PROJECT_ID');

  assert.ok(apiKey, 'API key must be present for live test');
  assert.ok(projectId, 'Project ID must be present for live test');

  // Sign up test user
  const testEmail = `test_runner_${Date.now()}@testchat.dev`;
  const testPassword = 'Password123!Safe';

  const signUpRes = await httpsRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: testEmail, password: testPassword, returnSecureToken: true }
  );

  assert.equal(signUpRes.status, 200, 'Firebase Auth signup should succeed');
  assert.ok(signUpRes.data.idToken, 'Must receive idToken');
  const idToken = signUpRes.data.idToken;

  try {
    // Test Firestore connectivity with token
    const firestoreRes = await httpsRequest(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`,
      { method: 'GET', headers: { Authorization: `Bearer ${idToken}` } }
    );

    assert.equal(firestoreRes.status, 200, 'Firestore collection read should succeed with 200');
    assert.ok(Array.isArray(firestoreRes.data.documents), 'Firestore users collection should return documents array');
  } finally {
    // Always clean up test user
    await httpsRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { idToken }
    );
  }
});

