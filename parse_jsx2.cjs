const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// I will write a simple regex stack to track HTML tags.
let stack = [];
let regex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
let match;
while ((match = regex.exec(code)) !== null) {
  let fullTag = match[0];
  let tagName = match[1];
  
  if (fullTag.endsWith('/>')) {
    continue; // self-closing
  }
  
  if (fullTag.startsWith('</')) {
    if (stack.length > 0 && stack[stack.length - 1] === tagName) {
      stack.pop();
    } else {
      console.log(`Mismatched closing tag: ${fullTag} at index ${match.index}. Expected ${stack[stack.length-1]}`);
      stack.pop();
    }
  } else {
    stack.push(tagName);
  }
}
console.log("Remaining stack:", stack);
