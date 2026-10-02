const fs = require('fs');
const path = 'lib/youtube-oauth.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /export function getYouTubeConfig\(\) \{[\s\S]*?const redirectUri = `\$\{appUrl\}\/api\/oauth\/youtube\/callback`;/m;

const replacement = `export function getYouTubeConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "production"
    ? "https://social-media-os.netlify.app"
    : "http://localhost:3000");
    
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || \`\${appUrl}/api/oauth/youtube/callback\`;`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Patched getYouTubeConfig');
