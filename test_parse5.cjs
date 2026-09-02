const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// There's a problem: the `Cannot use JSX unless the '--jsx' flag is provided.` errors mean it's parsing as TS, not TSX.
// But the real syntax errors are at the bottom!
