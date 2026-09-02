const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const lines = code.split('\n');
let p = 0;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for(let char of line) {
    if (char === '(') p++;
    if (char === ')') p--;
  }
}
console.log("Final p:", p);
