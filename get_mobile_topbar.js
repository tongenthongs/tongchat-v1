const fs = require('fs');
const content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

const sIdx = content.indexOf('                  {/* Header with Back Button (3 Baris Compact untuk Mobile) */}');
const eIdx = content.indexOf('                  {/* Chat Bubbles */}');
if (sIdx > -1 && eIdx > -1) {
    console.log(content.substring(sIdx, eIdx));
} else {
    console.log("Not found");
}
