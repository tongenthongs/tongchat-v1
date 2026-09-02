const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

let nodesReachingEof = [];

function visit(node) {
  if (node.end === sourceFile.end && node.kind !== ts.SyntaxKind.EndOfFileToken && node.kind !== ts.SyntaxKind.SourceFile) {
    nodesReachingEof.push(node);
  }
  ts.forEachChild(node, visit);
}

visit(sourceFile);

nodesReachingEof.forEach(node => {
    let start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    console.log(`Kind: ${ts.SyntaxKind[node.kind]} at line ${start.line + 1}`);
});
