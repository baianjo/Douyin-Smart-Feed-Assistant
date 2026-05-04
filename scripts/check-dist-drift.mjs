import { readFile } from 'node:fs/promises';
import { buildUserscriptContent, getDistFilePath, getPackageJson, normalizeLineEndings } from './userscript-content.mjs';

try {
  const pkg = await getPackageJson();
  const distFilePath = getDistFilePath(pkg.userscript.fileName);
  const expected = await buildUserscriptContent();
  const actual = normalizeLineEndings(await readFile(distFilePath, 'utf8'));

  if (actual !== expected) {
    console.error('dist/smart-feed-assistant.user.js is out of sync with source. Run `npm run build` and commit the result.');
    process.exit(1);
  }

  console.log('dist/smart-feed-assistant.user.js is in sync.');
} catch (error) {
  console.error('Failed to verify dist drift.', error);
  process.exit(1);
}
