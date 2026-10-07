const fs = require('fs');

let code = fs.readFileSync('app/api/webhooks/instagram/route.ts', 'utf8');

// Replace standard console logs with custom logger
code = code.replace(/console\.log\(`?\[IG_WEBHOOK\](.*?)(`|\))/g, "log(`[IG_WEBHOOK]$1`)");
// Also replace the static ones: console.log('[IG_WEBHOOK] ...')
code = code.replace(/console\.log\('\[IG_WEBHOOK\]([^']+)'\)/g, "log(`[IG_WEBHOOK]$1`)");

// Now we need to pass `log` array downwards
code = code.replace(/async function POST\(req: NextRequest\) \{[\s\S]*?try \{/, 
`export async function POST(req: NextRequest) {
  const diagnosticLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    diagnosticLogs.push(\`[\${new Date().toISOString()}] \${msg}\`);
  };

  try {`);

// Close try block and add finally
code = code.replace(/    return new NextResponse\('OK', \{ status: 200 \}\);\n  \} catch \(error: any\) \{/g,
`    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    log(\`[IG Webhook Error] \${error?.message || error}\`);
    console.error('[IG Webhook Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  } finally {
    if (diagnosticLogs.length > 0) {
      try {
        await prisma.activityLog.create({
          data: {
            action: 'IG_WEBHOOK_DIAGNOSTIC',
            details: 'Instagram Webhook Trace',
            metadata: JSON.stringify({ logs: diagnosticLogs })
          }
        });
      } catch (e) {
        console.error('Failed to save webhook diagnostic log to DB', e);
      }
    }
  }`);

// Add log argument to processCommentWebhook
code = code.replace(/await processCommentWebhook\(igAccountId, change\.value\);/g, "await processCommentWebhook(igAccountId, change.value, log);");
code = code.replace(/async function processCommentWebhook\(igAccountId: string, value: any\) \{/g, "async function processCommentWebhook(igAccountId: string, value: any, log: (msg: string) => void) {");

fs.writeFileSync('app/api/webhooks/instagram/route.ts', code);
