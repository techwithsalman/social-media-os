const fs = require('fs');

const page = 'app/(dashboard)/instagram-auto-dm/create/page.tsx';
let code = fs.readFileSync(page, 'utf8');

code = code.replace(
  'body: JSON.stringify(formData),',
  'body: JSON.stringify({ ...formData, buttonLabel: formData.includeButton ? formData.buttonLabel : "", destinationUrl: formData.includeButton ? formData.destinationUrl : "" }),'
);

fs.writeFileSync(page, code, 'utf8');
console.log('patched handleSubmit payload');
