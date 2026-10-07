const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walk(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walk('app/api/oauth', (filePath) => {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // We only replace if we find new URL(..., req.url)
    if (content.includes('req.url')) {
      if (!content.includes('getBaseUrl')) {
        content = "import { getBaseUrl } from '@/lib/url';\n" + content;
      }
      // Be careful not to replace `const { searchParams } = new URL(req.url)`
      // because that is used for incoming request parsing!
      // ONLY replace redirect target URLs.
      content = content.replace(/new URL\('([^']+)', req\.url\)/g, "new URL('$1', getBaseUrl(req))");
      fs.writeFileSync(filePath, content);
    }
  }
});
