const fs = require('fs');
const path = 'next.config.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('async headers()')) {
  const headersObj = `
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          }
        ],
      },
    ];
  },`;
  
  content = content.replace(/const nextConfig = \{/, 'const nextConfig = {' + headersObj);
  fs.writeFileSync(path, content);
  console.log('Added security headers to next.config.js');
}
