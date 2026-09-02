const fs = require('fs');
let content = fs.readFileSync('src/lib/firebase.ts', 'utf8');
content = content.replace(
  /export const messaging = null;/,
  `import { getMessaging, isSupported } from 'firebase/messaging';
export let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}`
);
fs.writeFileSync('src/lib/firebase.ts', content);
