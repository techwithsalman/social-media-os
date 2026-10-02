const fs = require('fs');

const path = 'lib/youtube-oauth.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /export function getYouTubeConfig\(\) \{[\s\S]*?const redirectUri = process\.env\.YOUTUBE_REDIRECT_URI \|\| `\$\{appUrl\}\/api\/oauth\/youtube\/callback`;/m;

const replacement = `export function getYouTubeConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Enforce explicit production URL exactly as registered in Google Cloud Console
  // Fallback to localhost ONLY if explicitly running local development
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 
    (process.env.NODE_ENV === "development" 
      ? "http://localhost:3000/api/oauth/youtube/callback" 
      : "https://social-media-os.netlify.app/api/oauth/youtube/callback");`;

if (content.includes('export function getYouTubeConfig() {')) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Fixed youtube redirect uri');
} else {
  console.log('Could not find getYouTubeConfig');
}
