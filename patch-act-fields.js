const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/activity/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(/log\.automationName/g, "log.rule?.name || 'Unknown'");
code = code.replace(/log\.igAccount/g, "log.socialAccount?.name || 'Unknown'");
code = code.replace(/log\.commenterUsername \|\| log\.commenter/g, "log.commenterId");
code = code.replace(/log\.commentText \|\| log\.comment/g, "log.commentText");
code = code.replace(/log\.time/g, "log.createdAt");
code = code.replace(/log\.errorMessage \|\| log\.error/g, "log.error");

fs.writeFileSync(page, code, 'utf8');
console.log('activity variables patched');
