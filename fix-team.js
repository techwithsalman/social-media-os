const fs = require('fs');

function replaceClass(file, from, to) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(from, to);
    fs.writeFileSync(file, c);
}

replaceClass('app/(dashboard)/team/page.tsx', 
    'className="py-5 first:pt-0 last:pb-0 flex items-center justify-between gap-5"',
    'className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5"'
);

console.log('Done');
