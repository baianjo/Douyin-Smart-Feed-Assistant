import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distPath = path.join(rootDir, 'dist', 'smart-feed-assistant.user.js');

const raw = await readFile(distPath, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

const dedent = (segment) =>
  segment
    .split('\n')
    .map((line) => line.replace(/^ {4}/, ''))
    .join('\n')
    .trim();

const findLine = (needle) => {
  const index = lines.findIndex((line) => line.includes(needle));
  if (index === -1) {
    throw new Error(`Unable to find marker: ${needle}`);
  }
  return index + 1;
};

const segmentBetween = (startNeedle, endNeedle) => {
  const start = findLine(startNeedle);
  const end = findLine(endNeedle);
  return dedent(lines.slice(start - 1, end - 1).join('\n'));
};

const segmentUntil = (startNeedle, endNeedleInclusiveStartExcluded) => {
  const start = findLine(startNeedle);
  const end = findLine(endNeedleInclusiveStartExcluded);
  return dedent(lines.slice(start - 1, end - 1).join('\n'));
};

const configChunk = segmentBetween('const CONFIG = {', 'const loadConfig = () => {');
const loadChunk = segmentBetween('const loadConfig = () => {', 'const saveConfig = async (config) => {');
const saveChunk = segmentUntil('const saveConfig = async (config) => {', '// ==================== 工具函数 ====================');
const utilsChunk = segmentUntil('const Utils = {', '// ==================== DOM操作模块 ====================');
const extractorChunk = segmentUntil('const VideoExtractor = {', '// ==================== AI交互模块 ====================').replaceAll(
  'UI.',
  'getUI().',
);
const aiChunk = segmentUntil('const AIService = {', '// ==================== UI模块 ====================').replaceAll(
  'UI.',
  'getUI().',
);
const uiChunk = segmentUntil('const UI = {', '// ==================== 主控制器 ====================').replaceAll(
  'Controller.',
  'getController().',
);
const controllerChunk = segmentUntil('const Controller = {', '// ==================== 初始化 ====================');
const initChunk = segmentUntil('const init = () => {', 'init();');

const files = [
  {
    filePath: path.join(rootDir, 'src', 'config', 'catalog.ts'),
    content: `${configChunk}\n\nexport { CONFIG };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'storage', 'config-storage.ts'),
    content: `import { CONFIG } from '../config/catalog';\n\n${loadChunk}\n\n${saveChunk}\n\nexport { loadConfig, saveConfig };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'utils', 'index.ts'),
    content: `${utilsChunk}\n\nexport { Utils };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'extractor', 'video-extractor.ts'),
    content: `import { getUI } from '../runtime/context';\nimport { Utils } from '../utils';\n\n${extractorChunk}\n\nexport { VideoExtractor };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'ai', 'ai-service.ts'),
    content: `import { CONFIG } from '../config/catalog';\nimport { getUI } from '../runtime/context';\n\n${aiChunk}\n\nexport { AIService };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'ui', 'ui.ts'),
    content: `import { AIService } from '../ai/ai-service';\nimport { CONFIG } from '../config/catalog';\nimport { getController } from '../runtime/context';\nimport { loadConfig, saveConfig } from '../storage/config-storage';\n\n${uiChunk}\n\nexport { UI };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'controller', 'controller.ts'),
    content: `import { AIService } from '../ai/ai-service';\nimport { VideoExtractor } from '../extractor/video-extractor';\nimport { loadConfig } from '../storage/config-storage';\nimport { UI } from '../ui/ui';\nimport { Utils } from '../utils';\n\n${controllerChunk}\n\nexport { Controller };\n`,
  },
  {
    filePath: path.join(rootDir, 'src', 'bootstrap', 'init.ts'),
    content: `import { Controller } from '../controller/controller';\nimport { setController, setUI } from '../runtime/context';\nimport { UI } from '../ui/ui';\n\nsetUI(UI);\nsetController(Controller);\n\n${initChunk}\n\nexport { init };\n`,
  },
];

for (const file of files) {
  await mkdir(path.dirname(file.filePath), { recursive: true });
  await writeFile(file.filePath, `${file.content.trim()}\n`, 'utf8');
}
