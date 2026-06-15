// Build script for the Enhanced Finder extension.
// Bundles the extension host (Node) and the webview front-end (browser).
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const watch = process.argv.includes('--watch');

// Copy the codicon font + css into media/ so they ship with the extension
// (node_modules is excluded from the packaged .vsix).
function copyCodicons() {
  const src = path.dirname(require.resolve('@vscode/codicons/package.json'));
  const outDir = path.join(__dirname, 'media', 'codicons');
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of ['codicon.css', 'codicon.ttf']) {
    fs.copyFileSync(path.join(src, 'dist', file), path.join(outDir, file));
  }
}

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ['media/main.ts'],
  bundle: true,
  outfile: 'media/main.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  logLevel: 'info',
};

async function main() {
  copyCodicons();
  if (watch) {
    const ctxExt = await esbuild.context(extensionConfig);
    const ctxWeb = await esbuild.context(webviewConfig);
    await Promise.all([ctxExt.watch(), ctxWeb.watch()]);
    console.log('watching...');
  } else {
    await Promise.all([esbuild.build(extensionConfig), esbuild.build(webviewConfig)]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
