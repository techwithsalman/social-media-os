/** @type {import('electron-builder').Configuration} */
module.exports = {
  productName: 'Social Media OS',
  appId: 'com.techwithsalman.socialmediaos',
  directories: {
    output: 'dist',
  },
  files: [
    'electron/**/*',
    'package.json',
    '.next/standalone/**/*',
    '.next/static/**/*',
    'public/**/*',
    'prisma/**/*',
  ],
  extraResources: [
    {
      from: 'prisma/dev.db',
      to: 'prisma/dev.db',
    },
    {
      from: 'node_modules/@prisma/engines',
      to: 'node_modules/@prisma/engines',
    },
    {
      from: 'node_modules/.prisma/client',
      to: 'node_modules/.prisma/client',
    },
  ],
  win: {
    target: ['nsis'],
    artifactName: 'Social Media OS Setup ${version}.${ext}',
    // Custom empty signing function to bypass winCodeSign symlink extraction on Windows
    sign: async () => {},
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Social Media OS',
    uninstallDisplayName: 'Social Media OS',
  },
};
