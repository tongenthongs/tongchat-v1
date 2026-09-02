const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

if (!content.includes('const [showMobileTopbar, setShowMobileTopbar] = useState<boolean>(false);')) {
  const stateInsertionPoint = "  const [mobileChatView, setMobileChatView] = useState<'LIST' | 'ROOM'>('LIST');";
  content = content.replace(stateInsertionPoint, stateInsertionPoint + "\n  const [showMobileTopbar, setShowMobileTopbar] = useState<boolean>(false);");
}

if (!content.includes('ChevronDown')) {
    content = content.replace('ChevronRight,', 'ChevronRight, ChevronDown, ChevronUp,');
}

fs.writeFileSync('src/components/admin/AdminPortal.tsx', content, 'utf8');
console.log('State added');
