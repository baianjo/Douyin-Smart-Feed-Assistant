# Developer README

这份文档是给后续维护者、二开者，或者“隔了一段时间回来已经忘了项目细节的人”准备的快速接管手册。

它不替代面向普通用户的 `README.md`。用户安装、配置、使用说明仍然以 `README.md` 为准；这份文档只关心如何继续开发、排障、发版和避免把项目带回单文件时代。

本项目所有文档都可以根据真实情况自由编辑和改动，包括 `README.md`、`DEVELOPER-README.md`、`docs/` 下的维护文档以及界面内说明文案。文档不是为了“保持原样”，而是为了让用户更容易上手、让维护者更容易判断、让项目持续贴近最佳实践。

## 1. 一分钟接管

如果你只想先知道最重要的事，先记住下面 9 条：

1. 这是一个运行在 Tampermonkey / Violentmonkey 上的 userscript，不是浏览器扩展，也不是服务端项目。
2. `src/` 才是源码；`dist/smart-feed-assistant.user.js` 是正式发布产物。
3. 对外安装入口必须继续保持为 `main/dist/smart-feed-assistant.user.js`。
4. 绝对不要手改 `dist`，必须通过 `npm run build` 生成。
5. 版本号只从 `package.json` 来，构建时自动注入 userscript header。
6. 用户配置兼容性比“代码洁癖”更重要，GM 存储键和旧字段语义不要随便破坏。
7. 抖音改版导致脚本失效时，第一怀疑对象通常是 DOM 选择器，而不是 AI 或构建系统。
8. 发版前至少跑 `npm run release:check`。
9. 文档和 UI 说明可以按真实体验随时改，目标是最佳实践、可维护、普通用户看得懂。

## 2. 项目到底在做什么

项目目标很简单：

- 在抖音网页版读取当前推荐视频的可见信息
- 调用用户配置的 AI 模型，对视频内容做偏好判断
- 按判断结果执行“点赞 / 略过 / 不感兴趣”
- 持续把用户偏好反馈给推荐系统，慢慢影响推荐流

一期工程化的目标不是“重做产品”，而是“把原来在脚本编辑框里维护的单文件脚本，收编成一个能长期维护的正规项目”。

所以现在这个仓库的核心设计原则是：

- 对外兼容优先
- 对内可维护优先
- 用户升级路径不能断

## 3. 当前工程基线

### 本机推荐基线

- 工作目录：`E:\ProgramProject\jsProject\douyin-smart-feed-assistant`
- Node：`24.15.0`
- 包管理器：`npm`
- Node 版本管理：`nvm for Windows`

### 为什么没有 Python / Java

当前一期工程化不依赖 Python 或 JDK。

如果以后真要引入新栈，原则是：

- 先确认是否真的必要
- 能复用现有本机体系就复用
- 先明确版本，再安装，不要边做边混装

## 4. 目录总览

```text
src/
  ai/               AI 请求构造、响应解析、判定归一化
  bootstrap/        入口初始化
  config/           默认配置、模板、选择器、模型厂商目录
  controller/       主循环、运行状态、错误恢复
  entry/            userscript 真正入口
  extractor/        抖音页面 DOM 提取
  runtime/          运行时依赖注入
  storage/          GM 存储读写与兼容校验
  ui/               悬浮按钮、设置面板、日志输出
  global.d.ts       GM / DOM 相关类型补充
  types.ts          核心类型
  utils/            通用工具

scripts/
  assemble-userscript.mjs   拼装 userscript header + bundle
  check-dist-drift.mjs      校验 dist 是否与源码构建结果一致
  migrate-legacy-dist.mjs   从历史单文件迁移源码时使用
  userscript-content.mjs    userscript 产物内容生成逻辑

tests/
  ai/
  extractor/
  storage/
  setup.ts

dist/
  smart-feed-assistant.user.js

docs/
  maintainer-guide.md
  release-process.md
```

## 5. 运行链路

理解下面这条链路，后续看代码会轻松很多：

1. `src/entry/userscript.ts`
   这是 userscript 打包入口。
2. `src/bootstrap/init.ts`
   判断是不是抖音页面，等待页面进入可运行状态，然后启动脚本。
3. `src/controller/controller.ts`
   维护主循环、运行状态、统计信息和错误恢复。
4. `src/extractor/video-extractor.ts`
   从当前视频 DOM 中提取标题、作者、标签、URL、直播状态等信息。
5. `src/storage/config-storage.ts`
   读取并校验用户配置，保证旧配置也能继续跑。
6. `src/ai/ai-service.ts`
   根据 provider 配置构造请求，调用模型并解析成统一判定。
7. `src/ui/ui.ts`
   负责设置面板、日志、开始停止、面板位置等 UI 行为。

一句话总结：
页面初始化 -> 读取配置 -> 提取视频上下文 -> 调 AI -> 执行动作 -> 记录状态 -> 进入下一轮

## 6. 现在有哪些核心数据模型

这些名字是后续继续开发时应该优先保留的稳定抽象：

- `UserConfig`
  合并默认值后的最终用户配置。
- `VideoContext`
  当前视频可分析信息，当前至少包含 `title / author / tags / url / isLive`。
- `DecisionResult`
  AI 判定结果，核心是 `action / reason`。
- `StorageAdapter`
  现在主要由 `loadConfig / saveConfig` 这组边界承担。

如果以后继续扩展 OCR、字幕、封面识别，建议优先扩展 `VideoContext`，而不是把新能力硬塞进 controller 或 UI。

## 7. 哪些约束不能轻易动

### 对外兼容约束

- 脚本身份不能变
- userscript header 里的 `@name`、`@namespace`、`@match`、`@grant`、`@downloadURL`、`@updateURL` 要保持兼容
- GitHub Raw 入口必须稳定
- Greasy Fork 继续沿用原脚本条目，不要新开一个替代脚本

### 数据兼容约束

- GM 存储键继续沿用旧值
- 旧字段语义不要随便改
- 新配置字段只追加默认值，不强制迁移
- API Key 只存用户本地脚本存储，不进入仓库

### 工程约束

- `src/` 是源码事实来源
- `dist/` 是正式发布产物
- `package.json` 是版本号单一来源
- `dist` 必须由源码构建得到

### 文档约束

- 文档要服务真实用户和真实维护，不要为了保留旧表述而牺牲清晰度
- 面向普通用户的说明必须足够细，尤其是 API Base URL、API Key、获取模型、测试连接这些容易卡住小白用户的步骤
- 模型推荐、价格、免费额度、可用性会变化，允许按实际验证结果更新 README、开发者文档和界面文案
- 所有文档都可以为了项目最佳实践自由编辑；需要保持的是事实准确、操作可验证、风险说清楚

## 8. 最常见开发任务，应该改哪里

### 场景 A：抖音页面改版，标题/作者/标签提取失效

优先看：

- `src/config/catalog.ts`
- `src/extractor/video-extractor.ts`

处理顺序建议：

1. 先确认是哪个字段提取失败
2. 用浏览器开发者工具看新的 DOM 结构
3. 优先补充或调整选择器数组
4. 再看提取逻辑是否需要适配
5. 补对应测试

不要一上来重写整套 extractor。

### 场景 B：某个 AI provider 改接口了

优先看：

- `src/config/catalog.ts`
- `src/ai/ai-service.ts`

处理原则：

1. 先改 provider 元数据
2. 只有元数据表达不了的差异，再改 `ai-service.ts`
3. 保持输出仍然收敛到统一的 `DecisionResult`

### 场景 C：想新增配置项

优先看：

- `src/types.ts`
- `src/config/catalog.ts`
- `src/storage/config-storage.ts`
- `src/ui/ui.ts`

新增配置项的标准动作通常是：

1. 在类型里加字段
2. 在默认配置里补默认值
3. 在存储校验里保证旧配置兼容
4. 在 UI 中暴露设置项
5. 按需补测试

### 场景 D：面板交互或日志表现要改

优先看：

- `src/ui/ui.ts`
- `src/controller/controller.ts`

规则是：

- 视觉和交互归 UI
- 运行状态和流程控制归 controller
- 不要把主循环逻辑直接塞进 UI

### 场景 E：想做二期增强，如 OCR / 字幕 / 更多上下文

建议新增或扩展的位置：

- 扩展 `VideoContext`
- 新增 extractor 子能力
- 在 controller 里组装完整上下文
- 保持 AI 输入仍然走统一服务层

不要把新能力直接缝进 build 脚本或 userscript header 生成流程。

## 9. 本地开发最短路径

### 第一次拉起

```bash
npm install
npm run build
npm run test
```

### 日常开发

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### 发版前一键检查

```bash
npm run release:check
```

它会串起来跑：

- `lint`
- `typecheck`
- `test`
- `build`
- `dist:check`

## 10. 构建与发布机制

### 构建做了什么

1. `tsup` 把 `src/entry/userscript.ts` 打成浏览器可运行 bundle
2. `scripts/assemble-userscript.mjs` 读取 `package.json` 里的 userscript 元信息
3. 自动生成 header，并和 bundle 拼成 `dist/smart-feed-assistant.user.js`

### `dist:check` 为什么重要

它的作用不是“看 Git 是否 dirty”，而是判断当前 `dist` 内容是否真的和源码构建结果一致。

这能防止两类典型事故：

- 改了源码却忘了提交新的 `dist`
- 手工改了 `dist`，但源码并没有同步

### 什么时候必须 bump 版本

只要你准备让已安装用户收到正式更新，就应该 bump `package.json` 版本。

原因很简单：

- GitHub Raw 内容会变
- Greasy Fork 可能会同步 URL 导入内容
- 但 userscript 客户端对自动更新最可靠的判断依据仍然是 `@version`

换句话说：
“代码变了但版本没变” 不是一个合格的正式发布状态。

## 11. 测试现状

当前测试覆盖的是最容易回归、最值得守住的几块：

- `tests/storage/config-storage.test.ts`
  配置兼容、默认值兜底、GM 存储行为
- `tests/extractor/video-extractor.test.ts`
  DOM 提取核心路径
- `tests/ai/ai-service.test.ts`
  请求构造与响应判定

当前还没有覆盖到非常完整的 UI 自动化和真实浏览器集成测试，所以每次涉及 UI、主循环或选择器大改时，仍然建议做一次手工验证。

## 12. 常见坑

### 坑 1：看到 `dist` 最直观，就顺手改 `dist`

不要这样做。`dist` 是发布产物，不是维护入口。

### 坑 2：为了“更整洁”重命名存储字段

这很容易让旧用户配置失效。兼容性优先。

### 坑 3：为了支持某个 provider，在多个文件里散改请求逻辑

先把差异收敛进 `catalog.ts`；真的表达不了，再动服务层。

### 坑 4：把产品增强和兼容修复混成一次大改

建议拆开：

- 一类提交只做兼容修复
- 一类提交再做功能增强

这样回滚、审查、排障都轻松很多。

### 坑 5：只看测试通过就以为 userscript 一定可用

这个项目本质上还是一个强依赖 DOM 与页面行为的 userscript。测试能守住很多回归，但不能完全替代真实页面验证。

## 13. 推荐的改动节奏

一个比较健康的节奏通常是：

1. 先确认要改的是“兼容修复”还是“功能增强”
2. 先改 `src/`
3. 补或更新测试
4. 跑 `npm run release:check`
5. 检查 `dist` diff 是否符合预期
6. 再提交和发版

## 14. 如果你完全失忆，建议这样重新上手

第一轮只做下面几步：

1. 先读 `README.md`
   这是站在用户视角理解产品。
2. 再读这份 `DEVELOPER-README.md`
   这是站在维护者视角理解工程。
3. 然后看 `src/controller/controller.ts`
   先抓主流程。
4. 再看 `src/extractor/video-extractor.ts` 和 `src/ai/ai-service.ts`
   理解输入和输出。
5. 最后看 `src/ui/ui.ts`
   理解用户怎么操作它。

如果还不确定从哪下手，优先问自己：

- 这是页面提取问题？
- 这是配置兼容问题？
- 这是 AI 请求问题？
- 这是 UI 展示问题？
- 还是发布流程问题？

这样定位会快很多。

## 15. 后续二期最值得做的方向

如果一期工程化稳定后继续开发，优先级建议大致如下：

1. 扩展 `VideoContext`
   加入字幕、封面、更多页面上下文。
2. 增强 extractor 的韧性
   例如更稳的选择器策略和更多兜底。
3. 增强测试覆盖
   尤其是 UI 状态、主循环和更复杂的 DOM fixture。
4. 改善日志与诊断体验
   让用户更容易报出可复现问题。
5. 建立更清晰的变更日志与发布说明习惯

## 16. 相关文档

- 用户文档：`README.md`
- 维护摘要：`docs/maintainer-guide.md`
- 发布流程：`docs/release-process.md`

这些文档都不是冻结资产。只要实际使用、发布流程、API 接入方式或小白用户理解成本发生变化，就应该及时改文档；共同目的不是“文档长得像以前”，而是让项目在当前阶段达到更好的工程和产品实践。

## 17. 最后一句

这个项目已经不是“只能在油猴编辑框里硬改的单文件脚本”了。

只要继续守住下面这条底线，它就能长期维护下去：

源码在 `src/`，发布从构建来，兼容性优先，版本要清晰，`dist` 不手改。
