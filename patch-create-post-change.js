const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const handleMasterCaptionChange = \(text: string\) => \{\s*setMasterCaption\(text\);\s*if \(syncCaptions\) \{\s*setPlatformSettings\(\(prev\) => \{\s*const next = \{ \.\.\.prev \};\s*Object\.keys\(next\)\.forEach\(\(plat\) => \{\s*next\[plat\] = \{\s*\.\.\.next\[plat\],\s*caption: text,\s*\};\s*\}\);\s*return next;\s*\}\);\s*\}\s*\};/m;

const replacement = `const handleMasterCaptionChange = (text: string) => {
    setMasterCaption(text);
    if (syncCaptions) {
      const paragraphs = text.split(/\\n\\s*\\n/).map(p => p.trim()).filter(Boolean);
      const autoYoutubeTitle = (paragraphs[0] || '').slice(0, 100);
      const autoYoutubeDescription = paragraphs.slice(1).join('\\n\\n') || '';

      setPlatformSettings((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((plat) => {
          if (plat === 'YOUTUBE') {
            next[plat] = {
              ...next[plat],
              youtubeTitle: next[plat].youtubeTitleManualOverride ? next[plat].youtubeTitle : autoYoutubeTitle,
              caption: next[plat].youtubeDescManualOverride ? next[plat].caption : autoYoutubeDescription,
            };
          } else {
            next[plat] = {
              ...next[plat],
              caption: text,
            };
          }
        });
        return next;
      });
    }
  };`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched handleMasterCaptionChange');
} else {
  console.log('Could not find handleMasterCaptionChange regex block');
}
