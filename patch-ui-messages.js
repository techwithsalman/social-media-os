const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/accounts/page.tsx', 'utf8');

const newMessages = `  const messages: Record<string, string> = {
    account_exists: 'This account is already connected to your workspace.',
    account_not_found: 'Account not found. You may have logged into a different account.',
    social_account_limit_reached: 'You have reached your connected account limit for your current plan.',
    authorization_cancelled: 'Meta login was cancelled before accounts were connected.',`;

code = code.replace(
  /  const messages: Record<string, string> = \{\s*authorization_cancelled: 'Meta login was cancelled before accounts were connected.',/,
  newMessages
);

fs.writeFileSync('app/(dashboard)/accounts/page.tsx', code);
