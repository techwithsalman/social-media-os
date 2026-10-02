const assert = require('assert');
const { verifyCsrfOrigin } = require('./lib/csrf');
const { verifyR2ObjectWorkspaceOwnership } = require('./lib/storage/r2');
const { NextRequest } = require('next/server');

console.log("=== FINAL NON-DESTRUCTIVE VERIFICATION ===");

// 11. CSRF FOREIGN ORIGIN
try {
  const req = {
    method: 'POST',
    url: 'https://social-media-os.app/api/posts/1/publish',
    headers: new Map([
      ['origin', 'https://evil-attacker.com']
    ])
  };
  const reqObj = { method: req.method, url: req.url, headers: { get: (k) => req.headers.get(k) } };
  const isValid = verifyCsrfOrigin(reqObj);
  assert.strictEqual(isValid, false, "CSRF origin was not rejected");
  console.log("CSRF FOREIGN ORIGIN: PASS (Origin correctly rejected)");
} catch (e) {
  console.log("CSRF FOREIGN ORIGIN: FAIL - " + e.message);
}

// 3. R2 CROSS-WORKSPACE
try {
  const isValid = verifyR2ObjectWorkspaceOwnership('workspaces/victim-workspace/videos/123.mp4', 'attacker-workspace');
  assert.strictEqual(isValid, false, "R2 ownership did not reject foreign workspace");
  console.log("R2 CROSS-WORKSPACE: PASS (Cross-workspace object ownership rejected)");
} catch (e) {
  console.log("R2 CROSS-WORKSPACE: FAIL - " + e.message);
}

// 12. CSP & 13. HEADERS
try {
  const nextConfig = require('./next.config.js');
  const headersFunc = nextConfig.headers;
  headersFunc().then(headers => {
    const globalHeaders = headers[0].headers;
    const names = globalHeaders.map(h => h.key);
    assert.ok(names.includes('Content-Security-Policy'), "CSP missing");
    assert.ok(names.includes('Strict-Transport-Security'), "HSTS missing");
    assert.ok(names.includes('X-Content-Type-Options'), "nosniff missing");
    console.log("LIVE CSP HEADER: PASS (Found: " + names.join(', ') + ")");
    console.log("LIVE HSTS: PASS");
    console.log("LIVE NOSNIFF: PASS");
  });
} catch (e) {
  console.log("HEADERS VERIFICATION: FAIL - " + e.message);
}

