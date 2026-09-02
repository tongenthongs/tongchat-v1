const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

let firstError = null;

function findErrors(node) {
  if (node.kind === ts.SyntaxKind.Error && !firstError) {
    firstError = node.getStart();
    const lc = sourceFile.getLineAndCharacterOfPosition(firstError);
    console.log(`Error at line ${lc.line + 1}, character ${lc.character + 1}, text: ${node.getText()}`);
  }
  ts.forEachChild(node, findErrors);
}

findErrors(sourceFile);
