import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET as callbackGET } from '../src/app/tiktok/callback/route';

async function runCallbackTests() {
  console.log('=== TESTING TIKTOK CALLBACK ROUTE PARAMETER HANDLING ===\n');

  // Test 1: Missing both code and state
  console.log('[Test 1] Testing missing both code and state...');
  const req1 = new NextRequest('http://localhost:3000/tiktok/callback');
  const res1 = await callbackGET(req1);
  const location1 = new URL(res1.headers.get('location')!);
  assert.strictEqual(location1.pathname, '/accounts');
  assert.strictEqual(location1.searchParams.get('tiktok_error'), 'invalid_callback_params');
  assert.ok(location1.searchParams.get('tiktok_error_desc')?.includes('No authorization code or state'), 'Should include descriptive error');
  console.log('✅ Test 1 Passed: invalid_callback_params with description.\n');

  // Test 2: Missing code with state present
  console.log('[Test 2] Testing missing code (state only)...');
  const req2 = new NextRequest('http://localhost:3000/tiktok/callback?state=abc123state');
  const res2 = await callbackGET(req2);
  const location2 = new URL(res2.headers.get('location')!);
  assert.strictEqual(location2.pathname, '/accounts');
  assert.strictEqual(location2.searchParams.get('tiktok_error'), 'missing_code');
  assert.ok(location2.searchParams.get('tiktok_error_desc')?.includes('authorization code'), 'Should indicate missing code');
  console.log('✅ Test 2 Passed: missing_code detected cleanly.\n');

  // Test 3: Missing state with code present
  console.log('[Test 3] Testing missing state (code only)...');
  const req3 = new NextRequest('http://localhost:3000/tiktok/callback?code=some_auth_code');
  const res3 = await callbackGET(req3);
  const location3 = new URL(res3.headers.get('location')!);
  assert.strictEqual(location3.pathname, '/accounts');
  assert.strictEqual(location3.searchParams.get('tiktok_error'), 'missing_state');
  console.log('✅ Test 3 Passed: missing_state detected cleanly.\n');

  // Test 4: TikTok error_code & error_description (e.g. redirect URI error)
  console.log('[Test 4] Testing TikTok error_code and redirect URI error description...');
  const req4 = new NextRequest('http://localhost:3000/tiktok/callback?error_code=10007&error_description=redirect_uri+mismatch+error');
  const res4 = await callbackGET(req4);
  const location4 = new URL(res4.headers.get('location')!);
  assert.strictEqual(location4.pathname, '/accounts');
  assert.strictEqual(location4.searchParams.get('tiktok_error'), 'redirect_uri_mismatch');
  assert.ok(location4.searchParams.get('tiktok_error_desc')?.includes('redirect_uri mismatch'), 'Should retain description');
  console.log('✅ Test 4 Passed: Redirect URI mismatch error mapped accurately.\n');

  // Test 5: Sanitization of sensitive strings in error description
  console.log('[Test 5] Testing sanitization of sensitive values in error description...');
  const req5 = new NextRequest('http://localhost:3000/tiktok/callback?error=access_denied&error_description=secret_token_12345678901234567890123456_forbidden');
  const res5 = await callbackGET(req5);
  const location5 = new URL(res5.headers.get('location')!);
  assert.strictEqual(location5.pathname, '/accounts');
  assert.strictEqual(location5.searchParams.get('tiktok_error'), 'access_denied');
  assert.strictEqual(location5.searchParams.get('tiktok_error_desc')?.includes('12345678901234567890123456'), false, 'Sensitive tokens must be redacted');
  assert.ok(location5.searchParams.get('tiktok_error_desc')?.includes('***'), 'Sensitive tokens must be masked with ***');
  console.log('✅ Test 5 Passed: Secret redaction in error callback verified.\n');

  console.log('=== ALL CALLBACK PARAMETER TESTS PASSED (5/5) ===');
}

runCallbackTests().catch((err) => {
  console.error('Callback test suite failed:', err);
  process.exit(1);
});
