const fs = require('fs');

const filesToPatch = [
  'app/api/auth/google/callback/route.ts',
  'app/api/auth/google/route.ts',
  'lib/instagram-oauth.ts',
  'lib/meta-token-service.ts',
  'lib/youtube-oauth.ts',
  'netlify/functions/cron.ts'
];

for (const file of filesToPatch) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace direct string assignments for production domains
  content = content.replace(
    /"https:\/\/social-media-os\.netlify\.app"/g,
    '(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.techwithsalman.online")'
  );
  
  content = content.replace(
    /'https:\/\/social-media-os\.netlify\.app'/g,
    "(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.techwithsalman.online')"
  );

  // For youtube specifically:
  content = content.replace(
    /"https:\/\/social-media-os\.netlify\.app\/api\/oauth\/youtube\/callback"/g,
    '((process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.techwithsalman.online") + "/api/oauth/youtube/callback")'
  );

  fs.writeFileSync(file, content);
  console.log('Patched', file);
}
