const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const l = (code.match(/<>/g) || []).length;
const r = (code.match(/<\/>/g) || []).length;
console.log({l, r});
