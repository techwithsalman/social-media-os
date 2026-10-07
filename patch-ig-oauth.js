const fs = require('fs');
let code = fs.readFileSync('lib/instagram-oauth.ts', 'utf8');

code = code.replace(
  /export async function createInstagramAuthorizationUrl\(session: SessionPayload\) \{/,
  "export async function createInstagramAuthorizationUrl(session: SessionPayload, mode: 'add' | 'reconnect' = 'add') {"
);

code = code.replace(
  /const state = randomToken\(\);/,
  "const state = `${mode}:${randomToken()}`;"
);

// We keep force_authentication=1 for both or replace it. Actually let's just add prompt=select_account if mode is add.
// The original code has: authUrl.searchParams.set('force_authentication', '1');
code = code.replace(
  /authUrl\.searchParams\.set\('force_authentication', '1'\);/,
  "if (mode === 'add') { authUrl.searchParams.set('prompt', 'select_account'); } else { authUrl.searchParams.set('force_authentication', '1'); }"
);

code = code.replace(
  /export async function saveInstagramAccount\(\s*profile: Awaited<ReturnType<typeof exchangeInstagramCode>>,\s*session: SessionPayload\s*\)\s*\{/,
  `export async function saveInstagramAccount(
  profile: Awaited<ReturnType<typeof exchangeInstagramCode>>,
  session: SessionPayload,
  mode: 'add' | 'reconnect' = 'add'
) {`
);

const newChecks = `  if (mode === 'add' && existing) {
    throw new InstagramOAuthError('ACCOUNT_EXISTS', 'This Instagram account is already connected to this workspace.', 409);
  }

  if (mode === 'reconnect' && !existing) {
    throw new InstagramOAuthError('ACCOUNT_NOT_FOUND', 'Account not found. You may have logged into a different Instagram account.', 404);
  }

  if (existing) {`;

code = code.replace(/  if \(existing\) \{/, newChecks);

fs.writeFileSync('lib/instagram-oauth.ts', code);
