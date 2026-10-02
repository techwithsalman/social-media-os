const fs = require('fs');
const path = 'app/(dashboard)/accounts/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<Share2 className="w-4 h-4" \/>\s*<span>Connect<\/span>/m;

const replacement = `{(plat.id === 'LINKEDIN' || plat.id === 'X' || plat.id === 'SNAPCHAT') ? (
                                <ExternalLink className="w-4 h-4" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                              <span>Connect</span>`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched UI for external links');
} else {
  console.log('Could not find UI block');
}
