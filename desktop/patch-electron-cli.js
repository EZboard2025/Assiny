// Patches electron/cli.js to remove ELECTRON_RUN_AS_NODE from spawn env.
// Without this, Electron runs as plain Node.js when launched from IDEs
// (like Cursor/VSCode) that set ELECTRON_RUN_AS_NODE=1.
const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, 'node_modules', 'electron', 'cli.js');

if (!fs.existsSync(cliPath)) {
  console.log('electron/cli.js not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(cliPath, 'utf-8');

if (content.includes('delete env.ELECTRON_RUN_AS_NODE')) {
  console.log('electron/cli.js already patched');
  process.exit(0);
}

// Replace the spawn call to include env cleanup
content = content.replace(
  /const child = proc\.spawn\(electron, process\.argv\.slice\(2\), \{ stdio: 'inherit', windowsHide: false \}\);/,
  `// Remove ELECTRON_RUN_AS_NODE so electron.exe starts in app mode (not Node mode)
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = proc.spawn(electron, process.argv.slice(2), { stdio: 'inherit', windowsHide: false, env: env });`
);

fs.writeFileSync(cliPath, content, 'utf-8');
console.log('electron/cli.js patched successfully');
