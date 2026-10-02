const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<label className="block text-xs md:text-sm font-bold text-slate-300 mb-1\.5">\s*Description \(Synced with Master Caption\)\s*<\/label>\s*<textarea\s*rows=\{3\}\s*disabled=\{syncCaptions\}\s*value=\{platformSettings\.YOUTUBE\?\.caption\}\s*onChange=\{\(e\) => updatePlatformSetting\('YOUTUBE', 'caption', e\.target\.value\)\}/m;

const replacement = `<label className="block text-xs md:text-sm font-bold text-slate-300 mb-1.5">
                        YouTube Description
                      </label>
                      <textarea
                        rows={3}
                        value={platformSettings.YOUTUBE?.caption}
                        onChange={(e) => updatePlatformSetting('YOUTUBE', 'caption', e.target.value)}`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched YouTube description UI');
} else {
  console.log('Could not find YouTube description UI block');
}
