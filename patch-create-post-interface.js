const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /youtubeTitle: string;\s*categoryId: string;\s*audience: string;\s*\}/m;

const replacement = `youtubeTitle: string;
    categoryId: string;
    audience: string;
    youtubeTitleManualOverride?: boolean;
    youtubeDescManualOverride?: boolean;
  }`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched PlatformSettingsState interface');
} else {
  console.log('Could not find PlatformSettingsState regex block');
}
