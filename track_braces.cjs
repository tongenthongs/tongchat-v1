const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const lines = code.split('\n');
let b = 0;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for(let char of line) {
    if (char === '{') b++;
    if (char === '}') b--;
  }
  // Print lines that are at b=1
  if (b === 1 && line.includes('{')) {
     console.log(`Line ${i+1}: ${line.trim()} (b=${b})`);
  }
}
console.log("Final b:", b);
