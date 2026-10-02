const fs = require('fs');
const path = 'app/(dashboard)/create-post/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const updatePlatformSetting = \(\s*platform: string,\s*key: keyof PlatformSettingsState,\s*value: any\s*\) => \{\s*setPlatformSettings\(\(prev\) => \(\{\s*\.\.\.prev,\s*\[platform\]: \{\s*\.\.\.\(prev\[platform\] \|\| DEFAULT_PLATFORM_SETTINGS\[platform\]\),\s*\[key\]: value,\s*\},\s*\}\)\);\s*\};/m;

const replacement = `const updatePlatformSetting = (
    platform: string,
    key: keyof PlatformSettingsState,
    value: any
  ) => {
    setPlatformSettings((prev) => {
      const platState = { ...(prev[platform] || DEFAULT_PLATFORM_SETTINGS[platform]) };
      platState[key] = value;
      
      if (platform === 'YOUTUBE') {
        if (key === 'youtubeTitle') platState.youtubeTitleManualOverride = true;
        if (key === 'caption') platState.youtubeDescManualOverride = true;
      }
      
      return {
        ...prev,
        [platform]: platState,
      };
    });
  };`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched updatePlatformSetting');
} else {
  console.log('Could not find updatePlatformSetting regex block');
}
