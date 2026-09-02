const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

function findUnbalanced(node) {
    if (ts.isJsxExpression(node)) {
        // Let's get the text and just count parens inside it.
        const text = node.getText();
        let p = 0;
        let inString = false;
        let strChar = '';
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            if ((char === '"' || char === "'" || char === '`') && text[i-1] !== '\\') {
                if (!inString) { inString = true; strChar = char; }
                else if (strChar === char) { inString = false; }
            }
            if (!inString) {
                if (char === '(') p++;
                if (char === ')') p--;
            }
        }
        if (p !== 0) {
            let s = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            console.log(`Unbalanced parens in JsxExpression at line ${s.line + 1}: ${text}`);
        }
    }
    ts.forEachChild(node, findUnbalanced);
}

findUnbalanced(sourceFile);
