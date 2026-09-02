const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

// Replace <option value="NEW"...>⏳ NEW</option>
content = content.replace(/<option value="NEW"[^>]*>⏳ NEW<\/option>\n/g, '');
// Replace <option value="NEW"...>NEW</option>
content = content.replace(/<option value="NEW"[^>]*>NEW<\/option>\n/g, '');

fs.writeFileSync('src/components/admin/AdminPortal.tsx', content);
