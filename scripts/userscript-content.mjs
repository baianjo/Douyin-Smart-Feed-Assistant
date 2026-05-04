import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const bundlePath = path.join(rootDir, '.build', 'userscript.global.js');

export const normalizeLineEndings = (text) => text.replace(/\r\n/g, '\n');

export const getPackageJson = async () => JSON.parse(await readFile(packageJsonPath, 'utf8'));

export const getDistFilePath = (fileName) => path.join(rootDir, 'dist', fileName);

export const buildUserscriptContent = async () => {
  const pkg = await getPackageJson();
  const meta = pkg.userscript;

  const lines = [
    '// ==UserScript==',
    `// @name         ${meta.name}`,
    `// @namespace    ${meta.namespace}`,
    `// @version      ${pkg.version}`,
    `// @description  ${meta.description}`,
    `// @author       ${meta.author}`,
    ...meta.match.map((match) => `// @match        ${match}`),
    ...meta.connect.map((connect) => `// @connect      ${connect}`),
    ...meta.grant.map((grant) => `// @grant        ${grant}`),
    `// @run-at       ${meta.runAt}`,
    `// @downloadURL  ${meta.downloadURL}`,
    `// @updateURL    ${meta.updateURL}`,
    `// @homepageURL  ${meta.homepageURL}`,
    `// @supportURL   ${meta.supportURL}`,
    `// @license      ${meta.license}`,
    '// ==/UserScript==',
    '',
  ];

  const bundle = normalizeLineEndings(await readFile(bundlePath, 'utf8'));
  return `${lines.join('\n')}${bundle}`;
};
