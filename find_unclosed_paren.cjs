const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const lines = code.split('\n');
let p = 0;
let stack = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for(let char of line) {
    if (char === '(') { p++; stack.push(`( at ${i+1}`); }
    if (char === ')') { p--; stack.pop(); }
  }
}
console.log("Unclosed (:", stack);
