const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

// Remove handleSyncUnclaimedOrders
content = content.replace(/const handleSyncUnclaimedOrders = async \(\) => \{[\s\S]*?setIsSyncingOrders\(false\);\n    \}\n  \};\n/g, '');

// Remove sync sidebar button
content = content.replace(/<button\s+onClick=\{handleSyncUnclaimedOrders\}[\s\S]*?<\/button>\n/g, '');

// Remove sync mobile header button
content = content.replace(/<button\s+type="button"\s+onClick=\{handleSyncUnclaimedOrders\}[\s\S]*?<\/button>\n/g, '');

// Remove isSyncingOrders state
content = content.replace(/const \[isSyncingOrders, setIsSyncingOrders\] = useState<boolean>\(false\);\n/g, '');

fs.writeFileSync('src/components/admin/AdminPortal.tsx', content);
