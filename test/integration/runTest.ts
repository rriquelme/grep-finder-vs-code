// Downloads a VS Code build and runs the integration test suite against the
// `examples/` workspace. Invoked by `npm run test:integration`.
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  // Compiled location: out/test/integration/runTest.js -> repo root is ../../..
  const repoRoot = path.resolve(__dirname, '../../..');
  const extensionDevelopmentPath = repoRoot;
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const workspace = path.resolve(repoRoot, 'examples');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspace, '--disable-extensions'],
  });
}

main().catch((err) => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
