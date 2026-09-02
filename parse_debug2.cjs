const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

let pos = code.indexOf('{selectedGame && (');
if(pos > -1) {
  let inner = code.substring(pos, code.length);
  console.log("Found modal logic:", inner.length, "bytes long");
}
