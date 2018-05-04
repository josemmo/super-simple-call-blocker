// Create output directory
const OUTPUT_DIR = __dirname + '/dist';
const fs = require('fs');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Define binaries to build
const version = require('./package.json').version;
const BINARIES = [
  {target: 'windows-x64-9.11.1', filename: `sscb-windows-x64-${version}.exe`},
  {target: 'windows-x86-9.11.1', filename: `sscb-windows-x86-${version}.exe`},
  {target: 'mac-x64-10.0.0', filename: `sscb-macos-x64-${version}`},
  {target: 'linux-x64-9.5.0', filename: `sscb-linux-x64-${version}`},
  {target: 'alpine-x86-9.5.0', filename: `sscb-alpine-x86-${version}`}
];

// Prepare to build
const nexe = require('nexe');
function build(i) {
  console.log(`[i] Building for ${BINARIES[i].target} . . .`);
  nexe.compile({
    input: './main.js',
    output: `${OUTPUT_DIR}/${BINARIES[i].filename}`,
    target: BINARIES[i].target,
    build: false
  }).then(() => {
    // Clear temporal files
    nexe.compile({
      clean: true,
      target: BINARIES[i].target
    }).then(() => {
      if ((i+1) < BINARIES.length) {
        build(i+1);
      } else {
        console.log('[i] Finished building sources');
        console.log('[i] Output directory: ' + OUTPUT_DIR);
      }
    });
  }).catch(() => {
    console.error(`[!] Failed to compile ${BINARIES[i].target}`);
  });
}

// Start building
console.log('[i] Generating binaries . . .');
build(0);
