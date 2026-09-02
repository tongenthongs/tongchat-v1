const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 210; i < 225; i++) {
  console.log(i + ": " + lines[i]);
}

console.log("-------");
for (let i = 425; i < 445; i++) {
  console.log(i + ": " + lines[i]);
}
