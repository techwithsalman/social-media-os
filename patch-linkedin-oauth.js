const fs = require('fs');
const path = 'lib/linkedin-oauth.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('session: SessionPayload')) {
  content = content.replace(
    /export async function exchangeLinkedInCode\(code: string, state: string\)/,
    "export async function exchangeLinkedInCode(code: string, state: string, session: SessionPayload)"
  );
  content = content.replace(
    /if \(\!stateRecord\) \{/,
    `if (!stateRecord) {
    throw new LinkedInOAuthError('Invalid or expired state', 'INVALID_STATE');
  }
  if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) {
    throw new LinkedInOAuthError('OAuth state does not match your session. Possible CSRF attack prevented.', 'STATE_MISMATCH');
  }
  if (false) {`
  );
  fs.writeFileSync(path, content);
}
