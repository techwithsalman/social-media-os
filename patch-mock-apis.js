const fs = require('fs');

function blockInProduction(filePath, afterString) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('Not available in production')) {
    console.log(filePath + ' already patched');
    return;
  }
  
  const patch = `
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }
  `;
  
  content = content.replace(afterString, afterString + '\\n' + patch);
  fs.writeFileSync(filePath, content);
  console.log('Patched ' + filePath);
}

blockInProduction('app/api/seed/route.ts', 'export async function POST() {\\n  try {');
blockInProduction('app/api/accounts/mock-connect/route.ts', 'export async function POST(req: NextRequest) {\\n  try {');

