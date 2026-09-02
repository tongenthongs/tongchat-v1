const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// I replaced `{!standaloneCategory && (<>` which was opened at line 214.
// AND I did NOT replace `</>)}` correctly! Because there is NO `</>)}` in the output of `grep -n "</>)"` earlier.
// Wait! I searched for `</>)}` and it wasn't found. 
// BUT what if it was JUST `</>}` or `</>) }`?

console.log(code.match(/<\/>\s*}\)/g));
console.log(code.match(/<\/>\s*\)}/g));
console.log(code.match(/}\s*\)/g));

// It's possible I removed the open `(` but the close `)` is still there somewhere!
