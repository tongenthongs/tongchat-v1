const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

let p = 0;
let b = 0;
let inString = false;
let strChar = '';
let inCommentLine = false;
let inCommentBlock = false;

let stackP = [];

for (let i = 0; i < code.length; i++) {
    let char = code[i];
    let nextChar = code[i+1];
    
    if (!inString && !inCommentLine && !inCommentBlock) {
        if (char === '/' && nextChar === '/') { inCommentLine = true; i++; continue; }
        if (char === '/' && nextChar === '*') { inCommentBlock = true; i++; continue; }
        
        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            strChar = char;
            continue;
        }
        
        if (char === '(') { p++; stackP.push(i); }
        if (char === ')') { p--; stackP.pop(); }
        if (char === '{') b++;
        if (char === '}') b--;
    } else if (inString) {
        if (char === '\\') { i++; continue; }
        if (char === strChar) { inString = false; }
    } else if (inCommentLine) {
        if (char === '\n') { inCommentLine = false; }
    } else if (inCommentBlock) {
        if (char === '*' && nextChar === '/') { inCommentBlock = false; i++; continue; }
    }
}

console.log({p, b});
if (stackP.length > 0) {
    let lastUnclosed = stackP[stackP.length - 1];
    // Find line number
    let lines = code.substring(0, lastUnclosed).split('\n');
    console.log(`Unclosed ( at line ${lines.length}`);
    console.log(`Line text: ${code.split('\n')[lines.length - 1]}`);
}

