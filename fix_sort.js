const fs = require('fs');
let code = fs.readFileSync('app/api/posts/route.ts', 'utf8');

const oldOrderBy = "orderBy: status === 'SCHEDULED' ? { scheduledFor: 'asc' } : { createdAt: 'desc' },";
const newOrderBy = `orderBy: status === 'SCHEDULED' 
        ? { scheduledFor: 'asc' } 
        : (status === 'PUBLISHED' || status === 'HISTORY')
          ? [
              { publishedAt: { sort: 'desc', nulls: 'last' } },
              { scheduledFor: { sort: 'desc', nulls: 'last' } },
              { createdAt: 'desc' }
            ]
          : { createdAt: 'desc' },`;

code = code.replace(oldOrderBy, newOrderBy);
fs.writeFileSync('app/api/posts/route.ts', code);
console.log('Fixed orderBy logic.');
