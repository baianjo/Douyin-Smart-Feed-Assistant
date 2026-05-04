import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildUserscriptContent, getDistFilePath, getPackageJson } from './userscript-content.mjs';

const pkg = await getPackageJson();
const distFilePath = getDistFilePath(pkg.userscript.fileName);

await mkdir(path.dirname(distFilePath), { recursive: true });
await writeFile(distFilePath, await buildUserscriptContent(), 'utf8');
