const fs = require('fs');
const path = 'lib/linkedin-oauth.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `  if (!stateRecord) {
    throw new LinkedInOAuthError('Invalid or expired state', 'INVALID_STATE');
  }`;

const replacement = `  if (!stateRecord) {
    throw new LinkedInOAuthError('Invalid or expired state', 'INVALID_STATE');
  }
  if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) {
    throw new LinkedInOAuthError('OAuth state does not match your session. Possible CSRF attack prevented.', 'STATE_MISMATCH');
  }`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
