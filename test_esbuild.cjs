const esbuild = require('esbuild');
const fs = require('fs');
let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');

try {
  let result = esbuild.transformSync(code, {
    loader: 'tsx',
    format: 'cjs',
    jsx: 'automatic'
  });
  
  const lines = result.code.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('div >') || line.includes(';     ^')) {
      console.log(`Line ${i+1}: ${line}`);
      console.log(`Surrounding: \n${lines.slice(i-2, i+3).join('\n')}`);
    }
  });
} catch(e) {
  console.log("esbuild error:", e);
}
