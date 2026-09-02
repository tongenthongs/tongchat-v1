const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

// A common issue with the typescript compiler API is that ts.SyntaxKind.Error doesn't always show up for missing trailing tokens!
// The TS compiler will log it when running `tsc`, though.
// We can use ts.createProgram to get proper diagnostics.

const configPath = ts.findConfigFile("./", ts.sys.fileExists, "tsconfig.json");
const program = ts.createProgram(['src/components/customer/Catalog.tsx'], {});
const emitResult = program.emit();
const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if(diagnostic.file.fileName.includes('Catalog.tsx')) {
        console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    }
  }
});
