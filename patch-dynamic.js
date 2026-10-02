const fs = require('fs');

function addForceDynamic(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes("export const dynamic = 'force-dynamic';")) {
    content = "export const dynamic = 'force-dynamic';\n" + content;
    fs.writeFileSync(filePath, content);
    console.log('Added force-dynamic to ' + filePath);
  }
}

addForceDynamic('app/api/oauth/youtube/connect/route.ts');
addForceDynamic('app/api/oauth/youtube/callback/route.ts');
