const fs = require('fs');
const path = 'lib/queue/publisher.ts';
let code = fs.readFileSync(path, 'utf8');

const targetRegex = /let finalStatus: 'PUBLISHED' \| 'INBOX_DRAFT' \| 'PROCESSING' \| 'PARTIALLY_FAILED' \| 'FAILED' = 'PUBLISHED';[\s\S]*?finalStatus = 'PUBLISHED';\s*\}/;

const replacement = `let finalStatus: 'PUBLISHED' | 'INBOX_DRAFT' | 'PROCESSING' | 'PARTIALLY_FAILED' | 'FAILED' = 'PUBLISHED';
      const totalCount = successCount + failCount + processingCount + inboxDraftCount;
      if (successCount === totalCount && successCount > 0) {
        finalStatus = 'PUBLISHED';
      } else if (inboxDraftCount === totalCount && inboxDraftCount > 0) {
        finalStatus = 'INBOX_DRAFT';
      } else if (successCount + inboxDraftCount === totalCount && (successCount > 0 || inboxDraftCount > 0)) {
        finalStatus = successCount > 0 ? 'PUBLISHED' : 'INBOX_DRAFT';
      } else if (failCount === totalCount && failCount > 0) {
        finalStatus = 'FAILED';
      } else if (processingCount > 0 && failCount === 0) {
        finalStatus = 'PROCESSING';
      } else if (failCount > 0) {
        finalStatus = 'PARTIALLY_FAILED';
      }`;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync(path, code);
    console.log('Successfully updated processPublishingJob aggregation logic.');
} else {
    console.log('Failed to match aggregation logic.');
}
