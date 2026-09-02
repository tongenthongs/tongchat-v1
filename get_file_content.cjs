const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

const ts = require('typescript');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

let foundError = false;
function findErrors(node) {
  if (node.kind === ts.SyntaxKind.Error && !foundError) {
    foundError = true;
    const lc = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    console.log(`Syntax Error at line ${lc.line + 1}`);
    const lines = code.split('\n');
    console.log(lines.slice(Math.max(0, lc.line - 10), lc.line + 5).join('\n'));
  }
  ts.forEachChild(node, findErrors);
}
findErrors(sourceFile);
