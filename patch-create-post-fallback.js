const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /customCaption: platSet\.caption \|\| masterCaption,/m;
const replacement = `customCaption: (platSet.caption !== undefined && platSet.caption !== null) ? platSet.caption : masterCaption,`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched customCaption fallback');
} else {
  console.log('Could not find customCaption regex block');
}
