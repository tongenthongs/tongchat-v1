const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

function findErrors(node) {
  if (node.kind === ts.SyntaxKind.Error) {
    console.log("Error at position:", node.getStart());
  }
  ts.forEachChild(node, findErrors);
}

findErrors(sourceFile);
console.log("Parsing test done.");
