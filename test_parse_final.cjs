const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const lines = code.split('\n');
let b = 0, p = 0;
let stack = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for(let char of line) {
    if (char === '{') { b++; stack.push(`{ at ${i+1}`); }
    if (char === '}') { b--; stack.pop(); }
  }
}
console.log("Unclosed {:", stack);
