const fs = require('fs');

const path = 'lib/instagram-oauth.ts';
let code = fs.readFileSync(path, 'utf8');

const oldScope = "'instagram_business_basic,instagram_business_content_publish'";
const newScope = "'instagram_business_basic,instagram_business_content_publish,instagram_manage_comments,instagram_manage_messages'";

code = code.replace(oldScope, newScope).replace(oldScope, newScope);

fs.writeFileSync(path, code, 'utf8');
console.log('patched scopes');
