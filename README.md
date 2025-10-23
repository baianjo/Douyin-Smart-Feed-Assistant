# 抖音推荐影响器 (Douyin Smart Feed Assistant)

## 项目简介

**抖音推荐影响器** 是一款基于人工智能的用户脚本工具,通过调用大语言模型 API 自动分析抖音推荐流中的视频内容,并根据用户预设的偏好规则执行点赞、忽略或标记"不感兴趣"等操作,从而逐步优化推荐算法,提升信息流质量。

### 核心特性

- **AI 智能分析** - 支持 DeepSeek、Kimi、通义千问、智谱 GLM 等多个主流大模型
- **灵活规则配置** - 内置多套预设模板(青少年引导、效率知识、健康生活等),也可完全自定义
- **人性化操作** - 模拟真人观看时长、随机跳过、延迟控制,降低被检测风险
- **透明可控** - 所有配置本地存储,API Key 不上传任何服务器
- **开源免费** - MIT 协议,代码完全公开

---

## 安装指南

### 第一步:安装浏览器扩展管理器

本脚本需要通过用户脚本管理器运行,请根据您的浏览器选择以下任一扩展:

#### 方案一:Tampermonkey(油猴)

**支持浏览器**: Chrome、Edge、Firefox、Safari、Opera

**安装链接**:
- Chrome/Edge: [Chrome 网上应用店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- Firefox: [Firefox 附加组件](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
- Safari: [App Store](https://apps.apple.com/app/tampermonkey/id1482490089)

#### 方案二:Violentmonkey(暴力猴)

**支持浏览器**: Chrome、Edge、Firefox

**安装链接**:
- Chrome/Edge: [Chrome 网上应用店](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag)
- Firefox: [Firefox 附加组件](https://addons.mozilla.org/zh-CN/firefox/addon/violentmonkey/)

**推荐选择**: 两者功能基本相同,如果您是新手,推荐使用 **Tampermonkey**(用户更多,教程更丰富)。

---

### 第二步:安装本脚本

安装好扩展管理器后,点击以下链接安装脚本:

```
https://raw.githubusercontent.com/baianjo/Douyin-Smart-Feed-Assistant/main/script.js
```

**详细步骤**:

1. 点击上方链接,浏览器会自动识别为用户脚本
2. 扩展管理器会弹出安装确认页面
3. 点击 **"安装"** 按钮
4. 安装成功后,访问 [抖音网页版](https://www.douyin.com) 即可看到右侧悬浮的机器人图标

**注意事项**:
- 脚本仅在抖音网页版(`www.douyin.com`)生效
- 移动端 APP 无法使用

---

## 使用教程(零基础版)

### 步骤一:获取 API Key

本脚本需要调用大语言模型进行内容分析,您需要先获取 API Key(理解为"通行证"即可)。

#### 什么是 API Key?

API Key 是一串由字母和数字组成的密钥(类似密码),用于向 AI 服务商证明您的身份。获取后粘贴到脚本配置中即可使用。

#### 如何选择 AI 服务商?

| 服务商 | 优势 | 参考价格 | 获取链接 |
|--------|------|----------|----------|
| **DeepSeek** | 价格最便宜,1元约1000次判断 | ¥0.001/次 | [立即获取](https://platform.deepseek.com/api_keys) |
| **Kimi** | 新用户赠送免费额度 | 有免费额度 | [立即获取](https://platform.moonshot.cn/console/api-keys) |
| **通义千问** | 阿里云旗下,稳定可靠 | 按量计费 | [立即获取](https://dashscope.console.aliyun.com/apiKey) |
| **智谱 GLM** | 国产模型,响应快 | 按量计费 | [立即获取](https://open.bigmodel.cn/usercenter/apikeys) |

**新手推荐**: 选择 **DeepSeek**(价格最低)或 **Kimi**(有免费额度)。

#### 获取步骤(以 DeepSeek 为例)

1. 点击 [DeepSeek 官网](https://platform.deepseek.com/api_keys)
2. 使用手机号或邮箱注册账号
3. 进入控制台后,点击 **"创建 API Key"**
4. 复制生成的密钥(格式类似 `sk-xxxxxxxxxxxxxx`)
5. **妥善保管**: 此密钥关联您的账户余额,切勿泄露

---

### 步骤二:配置脚本

1. 打开 [抖音网页版](https://www.douyin.com)
2. 点击页面右侧的 **机器人图标**,展开控制面板
3. 在 **基础设置** 标签页中:
   - **API 提供商**: 选择您刚才注册的服务商(如 DeepSeek)
   - **API Key**: 粘贴刚才复制的密钥
   - **模型选择**: 保持默认即可(如 `deepseek-chat`)
4. 点击 **"测试连接"** 按钮
   - 如果显示成功,说明配置正确
   - 如果显示失败,请检查 API Key 是否正确

---

### 步骤三:设置偏好规则

在 **基础设置** 中,您可以选择预设模板或自定义规则:

#### 使用预设模板(推荐新手)

点击 **预设模板** 下拉菜单,选择符合您需求的模板:

- **青少年内容引导** - 过滤低俗、娱乐化内容,推荐知识、科普类视频
- **效率与知识** - 聚焦商业、科技、技能学习
- **新闻与时事** - 关注严肃新闻和时事分析
- **健康生活** - 健身、饮食、心理健康等内容
- **艺术审美** - 绘画、音乐、设计等艺术创作

选择后,脚本会自动填充对应的规则描述。

#### 自定义规则

如果预设模板不满足需求,可以手动编辑三个规则框:

1. **点赞收藏规则** - 描述您希望看到的内容(如"深度科普、技术教程")
2. **忽略路过规则** - 描述普通内容的标准(如"日常 Vlog、美食探店")
3. **不感兴趣规则** - 描述要过滤的内容(如"低俗娱乐、过度营销")

**填写示例**:

```
【点赞规则】
我希望看到系统性的知识讲解、专业技能展示、逻辑思辨类内容。

【忽略规则】
普通的日常记录、萌宠、美食等娱乐内容。

【不感兴趣规则】
低俗、暴力、虚假信息、过度营销的内容。
```

---

### 步骤四:启动脚本

1. 配置完成后,点击面板右上角的 **"开始"** 按钮
2. 切换到 **运行日志** 标签页,查看实时处理进度
3. 脚本会自动:
   - 提取视频标题、作者、标签
   - 调用 AI 分析内容
   - 执行点赞/忽略/不感兴趣操作
   - 自动切换到下一个视频

**重要提示**:
- **必须保持抖音标签页可见**(不能切换到其他标签页)
- 可以最小化浏览器窗口,但抖音页面必须在当前激活标签
- 建议使用独立浏览器窗口运行,不影响其他工作

---

### 步骤五:查看统计与停止

- **查看统计**: 在 **运行日志** 标签页可以看到实时统计数据(已处理、点赞、忽略、不感兴趣)
- **停止运行**: 点击 **"停止"** 按钮即可终止
- **自动停止**: 达到设定的运行时长(默认 20 分钟)后自动停止

---

## 高级选项说明

在 **高级选项** 标签页中,可以调整以下参数:

| 参数名称 | 默认值 | 说明 |
|---------|--------|------|
| **操作前观看时长** | 2-4 秒 | 模拟真人观看一段时间后再操作 |
| **内容跳过概率** | 8% | 随机跳过部分视频,避免每个都操作 |
| **API 失败重试次数** | 3 次 | AI 调用失败时的最大重试次数 |

**建议**: 如无特殊需求,保持默认值即可。

---

## 常见问题(FAQ)

### 1. 使用本脚本大概需要多少费用?

**答**: 费用取决于您选择的 API 提供商和使用频率。

- **DeepSeek**: 约 ¥1 可判断 1000 个视频(最便宜)
- **Kimi**: 新用户赠送免费额度,可免费试用
- **通义千问/智谱 GLM**: 按量计费,价格略高于 DeepSeek

**节省技巧**:
- 设置较高的"内容跳过概率"(如 20%),减少 API 调用次数
- 控制每次运行时长(如 10-15 分钟),避免长时间挂机

---

### 2. 为什么不能使用 DeepSeek R1(深度思考)模型?

**答**: 推理模型(如 `deepseek-reasoner`、`R1` 等)会返回思考过程而非直接回答,导致:

1. **响应变慢** - 思考时间长,抖音会误以为您长时间停留在该视频
2. **费用更高** - 推理模型计费更贵,不划算
3. **解析失败** - 脚本无法正确识别推理内容

**解决方案**: 请使用标准对话模型,如 `deepseek-chat`(类似曾经的 DeepSeek-V3)、`gpt-4o-mini`、`claude-3.5-sonnet` 等。

---

### 3. 出现 400/422 错误怎么办?

**可能原因**:

- API Key 输入错误(注意前后空格)
- 选择的提供商与实际 Key 不匹配(如用 Kimi 的 Key 选了 DeepSeek)
- 自定义 API 地址填写错误
- 使用了推理模型(见问题 2)

**排查步骤**:

1. 检查 API Key 是否正确(复制时可能多了空格)
2. 确认"API 提供商"选择与 Key 匹配
3. 如果使用自定义 API,检查地址格式是否正确
4. 点击"测试连接"查看详细错误信息
5. 查看"运行日志"中的请求/响应详情

---

### 4. 脚本可以后台运行吗?

**答**: **不能完全后台运行**,但可以最小化窗口。

**具体要求**:
- 可以: 最小化浏览器窗口
- 可以: 将浏览器窗口移到屏幕外
- 不可以: 切换到其他标签页(必须保持抖音标签激活)
- 不可以: 电脑锁屏或休眠

**原因**: 脚本依赖键盘快捷键(如 `z` 点赞、`↓` 下滑)和 DOM 监听,需要页面处于活跃状态。

**建议**: 使用独立浏览器窗口运行,不影响其他工作。

---

### 5. 脚本会窃取我的 API Key 吗?

**答**: **绝对不会**。

- 所有配置数据(包括 API Key)仅存储在 **您的浏览器本地**
- 脚本使用 `GM_setValue` API,数据不会上传到任何服务器
- 源代码完全开源,您可以自行审查
- AI 调用直接发送到您选择的服务商(DeepSeek/Kimi 等),不经过任何中间服务器

**安全建议**:
- 不要在公共电脑上使用
- 定期检查 API Key 的使用记录(在服务商控制台查看)
- 如怀疑泄露,立即在服务商后台删除并重新生成

---

### 6. 为什么连续多次提示"无法定位当前视频"?

**答**: 这通常意味着 **抖音更新了页面结构**,导致脚本的 DOM 选择器失效。

**临时解决方案**:
1. 刷新页面后重试
2. 清除浏览器缓存
3. 检查是否有其他油猴脚本冲突

**长期解决方案**:
- 请将此问题反馈给作者(见下方联系方式)
- 作者会尽快更新选择器配置

---

### 7. 自定义 API 支持哪些参数?

**答**: 如果您使用兼容 OpenAI 格式的第三方 API,脚本会自动发送以下参数:

```json
{
  "model": "您填写的模型名称",
  "messages": [...],
  "temperature": 0.3,
  "max_tokens": 500,
  "stream": false
}
```

**重要限制**:
- 不支持流式输出(`stream` 已强制为 `false`)
- 不支持推理模型(会导致解析失败)
- 支持所有标准 OpenAI 兼容端点

---

### 8. 如何查看详细的运行日志?

**答**: 在 **运行日志** 标签页中:

1. 勾选 **"显示详细调试信息"** 复选框
2. 即可看到完整的 API 请求/响应内容
3. 包括请求地址、请求体、响应状态码等
4. 方便排查问题

---

### 9. 脚本会被抖音检测吗?会封号吗?

**答**: **存在风险**,但已尽力降低。

**风险评估**:
- 脚本模拟真人行为(随机延迟、观看时长、跳过概率)
- 但抖音仍可能通过行为模式检测出异常
- **目前未收到封号报告**,但不排除未来可能性

**降低风险建议**:
- 不要长时间连续运行(建议 10-20 分钟)
- 适当提高"内容跳过概率"(如 15-20%)
- 增加"操作间隔"(如 3-6 秒)
- 定期手动浏览,混合自动操作

**重要提示**: 作者不对因使用本工具导致的账号问题承担责任(见免责声明)。

---

### 10. 脚本突然失效了怎么办?

**最常见原因**: 抖音更新了页面 HTML 结构(每次大版本更新都可能发生)。

**排查步骤**:

1. **检查脚本是否已更新**:
   - 打开 Tampermonkey/Violentmonkey 面板
   - 查看脚本是否有新版本
   - 手动触发更新检查

2. **刷新页面后重试**:
   - 有时是临时的 DOM 加载问题

3. **反馈问题**:
   - 邮件: `1987892914@qq.com`
   - GitHub Issues: [点击提交](https://github.com/baianjo/Douyin-Smart-Feed-Assistant/issues)
   - 反馈时请附上:
     - 发现时间(如 2025-01-15)
     - 浏览器版本
     - 错误日志截图

---

### 11. 为什么有些视频的标题提取不完整?

**答**: 抖音网页版会折叠较长的标题,脚本已尽力提取完整内容,但可能受限于:

- 页面 DOM 结构变化
- 标题动态加载延迟
- 反爬虫机制

**解决方案**:
- 脚本会自动等待一段时间后重试
- 如果标题过短(少于 3 个字符),会跳过该视频
- 通常不影响整体判断准确性(还有作者、标签等信息)

---

### 12. 可以同时在多个标签页运行吗?

**答**: **强烈不建议**。

**原因**:
- 会大幅增加 API 调用费用
- 容易触发抖音的异常检测
- 可能导致浏览器卡顿

**建议**: 每次只在一个标签页运行,结束后再打开新标签页。

---

## 开发者维护指南

### 代码结构

```
script.js
├── CONFIG                 # 统一配置对象
│   ├── defaults          # 默认参数
│   ├── selectors         # DOM 选择器(最易失效)
│   ├── apiProviders      # API 提供商配置
│   └── templates         # 预设模板
├── Utils                 # 工具函数
├── VideoExtractor        # 视频信息提取
├── AIService             # AI 调用封装
├── UI                    # 界面管理
└── Controller            # 主控制逻辑
```

### 新增 API 提供商

在 `CONFIG.apiProviders` 中添加:

```javascript
newProvider: {
    name: '显示名称',
    endpoint: 'https://api.example.com/v1/chat/completions',
    defaultModel: 'model-name',
    models: [
        { value: 'model-1', label: '模型1(推荐)' },
        { value: 'model-2', label: '模型2' }
    ],
    requestParams: {
        temperature: 0.3,
        max_tokens: 500,
        stream: false
        // 如需特殊参数,使用 extra_body(会自动展开到请求体根级别)
    }
}
```

### 新增模型

在对应提供商的 `models` 数组中添加:

```javascript
{ value: 'new-model-id', label: '新模型名称' }
```

### 更新 DOM 选择器(重要)

当抖音更新页面结构时,需要更新 `CONFIG.selectors`:

```javascript
selectors: {
    title: [
        '新的标题选择器',  // 优先级最高
        '旧的备用选择器1',
        '旧的备用选择器2'
    ],
    author: [...],
    tags: [...]
}
```

**调试技巧**:
1. 打开 F12 开发者工具
2. 点击"选择元素"图标
3. 悬停在视频标题/作者上
4. 查看 HTML 结构中的 class 或 data 属性
5. 添加到选择器数组首位

---

## 贡献指南

欢迎提交 Pull Request 或 Issue!

### 如何贡献

1. Fork 本仓库
2. 创建特性分支(`git checkout -b feature/AmazingFeature`)
3. 提交更改(`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支(`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 提交规范

- **代码风格**: 遵循原有代码格式
- **提交信息**: 使用中文,清晰描述变更内容
- **测试**: 确保在最新版 Chrome/Edge 上测试通过

---

## 反馈与支持

### 联系方式

- **邮箱**: 1987892914@qq.com
- **GitHub Issues**: [提交问题](https://github.com/baianjo/Douyin-Smart-Feed-Assistant/issues)

### 反馈时请提供

1. 问题描述(越详细越好)
2. 浏览器版本(如 Chrome 120.0.6099.109)
3. 脚本版本(在"关于"标签页查看)
4. 错误日志截图(在"运行日志"标签页中)
5. 复现步骤

---

## 免责声明

### 重要提示

#### 一、使用风险

1. 本工具仅供学习和个人研究使用
2. 使用本工具可能违反抖音服务条款
3. 因使用本工具导致的账号问题(包括但不限于封禁、限流、数据丢失),作者不承担任何责任
4. 用户应自行评估使用风险并承担全部后果

#### 二、法律责任

1. 用户应遵守中华人民共和国相关法律法规
2. 用户应遵守抖音平台的用户协议和社区规范
3. 因违反法律法规或平台规则导致的一切后果由用户自行承担
4. 本工具不得用于任何违法违规目的

#### 三、数据安全

1. API Key 仅存储在用户浏览器本地,不会上传到任何服务器
2. 用户需自行保管 API Key,防止泄露
3. 因 API Key 泄露导致的费用损失,作者不承担任何责任
4. 建议定期更换 API Key 并检查使用记录

#### 四、服务可用性

1. 本工具依赖第三方 API 服务,可能因服务商故障、政策变更等原因导致不可用
2. 本工具可能因抖音平台更新而失效,作者会尽力维护但不保证时效性
3. 作者保留随时停止维护本项目的权利
4. 作者不对工具的持续可用性做任何承诺

#### 五、内容责任

1. 用户自行配置的规则和模板产生的结果由用户自行负责
2. 本工具不对 AI 模型的判断结果负责
3. 因 AI 判断错误导致的任何后果(如误操作、推荐偏差)由用户自行承担
4. 用户应确保配置的规则符合法律法规和社会公德

#### 六、技术限制

1. 本工具基于网页 DOM 结构开发,可能因平台更新而失效
2. 作者不保证代码的绝对安全性和无错性
3. 使用本工具可能导致浏览器性能下降或其他技术问题
4. 用户应具备基本的计算机操作能力和风险识别能力

#### 七、知识产权

1. 本工具基于 MIT License 开源,允许自由使用、修改和分发
2. 使用者需保留原作者版权信息
3. 二次开发或分发时需遵守 MIT 协议条款
4. 不得用于任何商业用途的虚假宣传

### 使用即表示同意

下载、安装或使用本工具即表示您已阅读、理解并同意以上所有条款。如果您不同意任何条款,请立即停止使用并卸载本工具。

### 法律适用

本声明的解释、效力及纠纷解决均适用中华人民共和国法律。若有争议,双方应友好协商解决;协商不成的,任何一方可向作者所在地人民法院提起诉讼。

---

## 许可证

```
MIT License

Copyright (c) 2025 Baianjo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 致谢

- 感谢所有提供反馈和建议的用户
- 感谢开源社区的技术支持
- 特别感谢 DeepSeek、Kimi、Qwen、GLM 等 AI 服务提供商

---

## 更新日志

### v2.0.0 (2025-10)

- 重构代码架构,提升稳定性
- 新增多个预设模板
- 优化 AI 调用逻辑,降低超时概率
- 新增详细调试日志开关
- 改进 DOM 选择器,适配最新版抖音
- 新增连续错误检测机制
- 优化配置保存逻辑,解决 NaN 问题
- 增强安全性,防止 XSS 攻击
- 改进用户界面,提升易用性

### v1.x (早期版本)

- 初始版本发布
- 基础功能实现

---

## Star History

如果觉得这个项目对您有帮助,请点击右上角的 ⭐ Star 支持一下,这是对作者最大的鼓励!

---

**最后更新**: 2025-01  
**当前版本**: 2.0.0  
**维护状态**: 积极维护中
