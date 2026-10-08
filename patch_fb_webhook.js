const fs = require('fs');

let content = fs.readFileSync('app/api/webhooks/facebook/route.ts', 'utf8');

const oldProcess = `async function processCommentWebhook(pageId: string, value: any) {
  const { comment_id: commentId, from, message, post_id: postId } = value;
  
  if (!commentId || !from || !message || !postId) return;`;

const newProcess = `async function processCommentWebhook(pageId: string, value: any) {
  const { comment_id: commentId, from, message, post_id: postId } = value;
  
  console.log('[FB_AUTO_DM] WEBHOOK_RECEIVED=true');
  console.log(\`[FB_AUTO_DM] PAGE_ID_PRESENT=\${!!pageId}\`);
  console.log(\`[FB_AUTO_DM] POST_ID_PRESENT=\${!!postId}\`);
  console.log(\`[FB_AUTO_DM] COMMENT_ID_PRESENT=\${!!commentId}\`);
  console.log(\`[FB_AUTO_DM] COMMENT_TEXT_PRESENT=\${!!message}\`);

  if (!commentId || !from || !message || !postId) return;`;

content = content.replace(oldProcess, newProcess);

const oldIsMatch = `    const isMatch = rule.matchType === 'EXACT'
      ? message.trim().toLowerCase() === rule.keyword.toLowerCase()
      : message.toLowerCase().includes(rule.keyword.toLowerCase());`;

const newIsMatch = `    let isMatch = false;
    if (rule.matchType === 'ANY_COMMENT') {
      isMatch = true;
    } else if (rule.matchType === 'EXACT') {
      isMatch = message.trim().toLowerCase() === rule.keyword.trim().toLowerCase();
    } else { // CONTAINS
      isMatch = message.toLowerCase().includes(rule.keyword.toLowerCase());
    }`;

content = content.replace(oldIsMatch, newIsMatch);

fs.writeFileSync('app/api/webhooks/facebook/route.ts', content);
console.log('Patched FB webhook');
