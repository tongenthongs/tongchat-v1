const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

let lines = code.split('\n');
let p = 0;
let modalStart = -1;
let modalEnd = -1;

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('{selectedGame && (')) {
    modalStart = i;
  }
}
if(modalStart > -1) {
    for(let i = modalStart; i < lines.length; i++) {
        for(let char of lines[i]) {
            if (char === '(') p++;
            if (char === ')') p--;
        }
        if (p === 0 && modalStart > -1) {
            modalEnd = i;
            break; // well this is tricky because p starts at 0 before we count the line.
        }
    }
}
console.log("Modal starts at:", modalStart+1);
console.log("Modal end around:", modalEnd+1);

