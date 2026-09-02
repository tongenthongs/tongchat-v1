const fs = require('fs');
const code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const lines = code.split('\n');
console.log(lines.slice(665, 680).join('\n'));
