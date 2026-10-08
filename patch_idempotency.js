const fs = require('fs');
const file = 'app/api/webhooks/instagram/route.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Check idempotency[\s\S]*?status: 'PENDING'\s*\}\s*\}\);/;

const replacement = `console.log('[IG_WEBHOOK] DUPLICATE_CHECK');
      let execution;
      try {
        // Create pending execution. If a race condition or replay occurs, Prisma throws P2002
        // because of the @@unique([ruleId, commentId]) constraint in the schema.
        execution = await prisma.instagramAutoDmExecution.create({
          data: {
            ruleId: rule.id,
            workspaceId: rule.workspaceId,
            socialAccountId: account.id,
            commentId,
            commenterId,
            commentText: text,
            status: 'PENDING'
          }
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log('[IG_WEBHOOK] DUPLICATE_COMMENT_SKIPPED=true');
          // This comment was already processed for this rule.
          // Return to prevent replay-spillover to other rules.
          return;
        }
        throw err;
      }
      
      console.log('[IG_WEBHOOK] DUPLICATE_COMMENT_SKIPPED=false');`;

code = code.replace(regex, replacement);

fs.writeFileSync(file, code);
