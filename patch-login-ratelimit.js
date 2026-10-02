const fs = require('fs');
const path = 'app/api/auth/login/route.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('getRateLimit')) {
  content = content.replace(
    /export async function POST\(req: NextRequest\) \{\s*try \{/,
    `import { getRateLimit } from '@/lib/rate-limit';\n\nexport async function POST(req: NextRequest) {\n  try {\n    const ip = req.headers.get('x-forwarded-for') || 'unknown';\n    const rateLimit = getRateLimit(\`login_\${ip}\`, 5, 60 * 1000);\n    if (!rateLimit.success) return NextResponse.json({ error: 'Too many attempts, try again later.' }, { status: 429 });\n`
  );
  fs.writeFileSync(path, content);
  console.log('Added rate limiting to login');
}
