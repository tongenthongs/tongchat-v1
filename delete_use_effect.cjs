const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// I will just split by lines, remove the exact line if it's there.
let lines = code.split('\n');
let index = -1;
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('useEffect(() => {') && lines[i+1] && lines[i+1].includes('handleDismissWarning')) {
        index = i;
        break;
    }
}
if (index > -1) {
    lines.splice(index, 1); // remove the useEffect line
}
fs.writeFileSync('src/components/customer/Catalog.tsx', lines.join('\n'));
