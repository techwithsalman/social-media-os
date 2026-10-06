const fs = require('fs');

const path = 'components/layout/Sidebar.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add MessageCircle import
code = code.replace(/BarChart3,/g, 'BarChart3,\n  MessageCircle,');

// 2. Add nav item
const oldNav = `{ label: 'Analytics', href: '/analytics', icon: BarChart3 },`;
const newNav = `{ label: 'Analytics', href: '/analytics', icon: BarChart3 },\n  { label: 'Instagram Auto DM', href: '/instagram-auto-dm', icon: MessageCircle, badge: 'Beta' },`;

code = code.replace(oldNav, newNav);

fs.writeFileSync(path, code, 'utf8');
console.log('Sidebar updated.');
