const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// There is a duplicate `    </div>\n  );\n};` at the very end.
code = code.replace(/    <\/div>\n  \);\n};\n    <\/div>\n  \);\n};$/, '    </div>\n  );\n};\n');

// Also, let's fix the missing `</>)}` issue correctly if any.
fs.writeFileSync('src/components/customer/Catalog.tsx', code);
