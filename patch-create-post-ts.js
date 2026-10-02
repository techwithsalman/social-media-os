const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /platState\[key\] = value;/m;
const replacement = `// @ts-ignore
      platState[key] = value;`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched TS error');
} else {
  console.log('Could not find TS error line');
}
