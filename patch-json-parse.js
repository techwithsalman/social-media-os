const fs = require('fs');
const path = 'app/super-admin/users/[id]/UserDetailClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /const data = await res\.json\(\);\s*if \(!res\.ok\) throw new Error\(data\.error \|\| 'Action failed'\);\s*setMessage\(\{ type: 'success', text: 'Action successful' \}\);/m;

const replacement = `let data = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse JSON:', text);
        }
      }
      
      if (!res.ok) {
        throw new Error(data.error || \`Action failed (\${res.status})\`);
      }
      
      setMessage({ 
        type: 'success', 
        text: data.message || 'Action successful' 
      });`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content);
  console.log('Patched UserDetailClient.tsx JSON parsing');
} else {
  console.log('Could not find regex in UserDetailClient.tsx');
}
