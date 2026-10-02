const fs = require('fs');
const path = 'app/super-admin/users/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{new Date\(user\.renewalDate\)\.toLocaleDateString\(\)\}/g;
content = content.replace(regex, "{new Date(user.renewalDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}");

fs.writeFileSync(path, content);
console.log('Fixed date format in users page');
