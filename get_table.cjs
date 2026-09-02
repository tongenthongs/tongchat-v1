const fs = require('fs');
const content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

const sIdx = content.indexOf('<table className="w-full text-left text-xs min-w-max border-collapse">');
const eIdx = content.indexOf('</table>', sIdx) + 8;
if (sIdx > -1) {
    console.log(content.substring(sIdx, eIdx));
} else {
    console.log("Not found");
}
