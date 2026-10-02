const fs = require('fs');

let pagePath = 'app/super-admin/users/page.tsx';
let content = fs.readFileSync(pagePath, 'utf8');
content = content.replace(/\\\$/g, '$').replace(/\\`/g, '`');
fs.writeFileSync(pagePath, content);
console.log('Fixed page.tsx');

let clientPath = 'app/super-admin/users/[id]/UserDetailClient.tsx';
let clientContent = fs.readFileSync(clientPath, 'utf8');
clientContent = clientContent.replace(/\\\$/g, '$').replace(/\\`/g, '`');
fs.writeFileSync(clientPath, clientContent);
console.log('Fixed UserDetailClient.tsx');
