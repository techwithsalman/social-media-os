const fs = require('fs');

const path = 'app/(dashboard)/instagram-auto-dm/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// The easiest way is to wrap the default export component inside a Suspense, and rename the inner component.
// Right now, `export default function InstagramAutoDmPage() {`
// Let's rename it to `function InstagramAutoDmContent() {`
// And add `export default function InstagramAutoDmPage() { return <Suspense fallback={<div>Loading...</div>}><InstagramAutoDmContent /></Suspense>; }`

code = code.replace(
  'export default function InstagramAutoDmPage() {',
  'import { Suspense } from "react";\n\nfunction InstagramAutoDmContent() {'
);

code += `\n\nexport default function InstagramAutoDmPage() {\n  return (\n    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading...</div>}>\n      <InstagramAutoDmContent />\n    </Suspense>\n  );\n}\n`;

fs.writeFileSync(path, code, 'utf8');
console.log('patched Suspense');
