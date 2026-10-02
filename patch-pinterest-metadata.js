const fs = require('fs');
const path = 'integrations/pinterest/index.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /if \(\!payload\.boardId\)/g,
  "if (!payload.metadata?.boardName)"
);
content = content.replace(
  /board_id: payload\.boardId/g,
  "board_id: payload.metadata?.boardName"
);
content = content.replace(
  /if \(payload\.link\)/g,
  "if (payload.metadata?.linkUrl)"
);
content = content.replace(
  /body\.link = payload\.link/g,
  "body.link = payload.metadata?.linkUrl"
);
content = content.replace(
  /title: payload\.title/g,
  "title: payload.metadata?.title"
);

fs.writeFileSync(path, content);
console.log('Patched integrations/pinterest/index.ts');
