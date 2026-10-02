const fs = require('fs');
const path = 'next.config.js';
let content = fs.readFileSync(path, 'utf8');

const csp = "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';";

content = content.replace(
  /key: 'Referrer-Policy',\s*value: 'strict-origin-when-cross-origin',\s*\}/,
  \`key: 'Referrer-Policy',\n            value: 'strict-origin-when-cross-origin',\n          },\n          {\n            key: 'Content-Security-Policy',\n            value: "\${csp}",\n          }\`
);

fs.writeFileSync(path, content);
console.log('Added CSP to next.config.js');
