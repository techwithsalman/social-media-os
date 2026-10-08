const fs = require('fs');

function unescapeFile(path) {
  let content = fs.readFileSync(path, 'utf-8');
  content = content.replace(/\\\`/g, '\`');
  content = content.replace(/\\\$/g, '\$');
  fs.writeFileSync(path, content);
}

unescapeFile('app/(dashboard)/scheduled/page.tsx');
unescapeFile('app/(dashboard)/calendar/page.tsx');
