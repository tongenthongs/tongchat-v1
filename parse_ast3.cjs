const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

const stmts = sourceFile.statements;
const lastStmt = stmts[stmts.length - 1];
console.log("Last statement kind:", ts.SyntaxKind[lastStmt.kind]);

let start = sourceFile.getLineAndCharacterOfPosition(lastStmt.getStart());
let end = sourceFile.getLineAndCharacterOfPosition(lastStmt.getEnd());
console.log(`From line ${start.line + 1} to line ${end.line + 1}`);

// Now print the children of the last statement recursively.
function printTree(node, indent = "") {
    let s = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    console.log(`${indent}${ts.SyntaxKind[node.kind]} (line ${s.line + 1})`);
    ts.forEachChild(node, child => printTree(child, indent + "  "));
}
// printTree(lastStmt);
