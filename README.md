# InternalBeyond-Mobile

一个围绕「维系情感连续性」的个人 AI 陪伴应用：本地优先存储、账号登录后云端同步、AI 密钥仅存服务端。移动端同源版本。

> 架构、部署与本地运行详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 与 [`DEPLOY.md`](DEPLOY.md)。

---

## ✦ 快速开始

```bash
npm install
npm run dev          # 并发启动 backend(:10000) + frontend(:5173)
# 打开 http://localhost:5173 → 注册 / 登录 → 数据自动拉取与同步
```

部署（Render 双服务：前端 Static Site + 后端 Web Service）见 [`DEPLOY.md`](DEPLOY.md)。

---

## ✦ 技术架构

- **前端**：Vite 5 + React 18 + TypeScript（Render Static Site）
- **后端**：Node.js + Express 4 + TypeScript（Render Web Service）
- **数据库**：MongoDB Atlas + Mongoose，按用户隔离
- **本地优先**：浏览器 IndexedDB（Dexie）缓存，登录后增量同步到云端（逐条 last-write-wins + 墓碑删除）
- **AI 代理**：密钥在服务端 AES-256-GCM 加密，浏览器不持有明文；支持 Claude / GPT / DeepSeek / Gemini / 自定义中转

---

## ✦ 功能一览

| 模块 | 说明 |
|------|------|
| **Home** | 伪 iOS 主屏：Desk 桌面（应用矩阵 + 月历 / 便笺 / 日程 / 音乐挂件）、Space 液态玻璃个人名片（简介作为上下文发给所有 AI）、Circle 社交圈入口 |
| **Lock** | iOS 式锁屏 —— 密码锁 + 壁纸，配置仅存本机；支持密保问答找回 |
| **Chat** | 多端口 AI 实时对话 —— 流式回复、思考链、附件、联网检索、操作卡片、对话摘要、生成记忆 |
| **Circle** | 社交圈 —— 你与已授权的 AI 互发动态、评论、转发，逐条可见范围；AI 可自动接话与主动关怀 |
| **Calendar** | 日历 —— 纪念日 / 生日 / 计划 / 备忘，重复规则，AI 读取临近日程并自然提起 |
| **Blog** | 日志 / 密码日记本 / 分类管理 / AI 留言与段落批注 / 阅读视图 |
| **Letters** | 邮局 —— 写信投递、火漆拆信、信箱；可让 AI 代笔或主动来信 |
| **Memory** | 长期情感记忆库 —— 情感坐标（效价 / 唤醒度 / 重要性）+ Auto Memory 认知档案；支持 AI 提炼坐标 |
| **Music** | 全屏黑胶播放器 —— 逐句滚动歌词（.lrc / .srt / .vtt）、播放队列；一起听跨端同步播放光标 |
| **ICode** | 文件工作区 —— 项目分组、AI 读写 / 局部改写、GitHub PAT 直连列仓库 / 导入 / 一键推回 |
| **Visual** | 视觉个性化 —— 全站主色、字号缩放、4 个方案槽（本地） |
| **API** | 多端口配置中心 —— 昵称 / 关系 / 提示词 / 逐项权限 |
| **DIY** | 外部 HTTP / MCP 工具，由后端代发请求（绕过 CORS），支持调用前确认 |
| **Data** | 一键备份 —— 全站导出 / 导入 JSON、聊天记录管理、存储总览 |

---

## ✦ 主题系统

点击顶栏水滴按钮切换：

- **Internal** — 明亮模式。
- **Infernal** — 暗色模式。

---

## ✦ API 配置指南

支持多种 AI 服务：

| 服务商 | 注册地址 | 中选择 | 密钥格式 |
|--------|---------|-----------|---------|
| Anthropic (Claude) | console.anthropic.com | `Claude (Anthropic)` | sk-ant-… |
| OpenAI (GPT) | platform.openai.com | `GPT (OpenAI)` | sk-… |
| DeepSeek | platform.deepseek.com | `DeepSeek` | sk-… |
| Google (Gemini) | aistudio.google.com | `Gemini (Google)` | AIza… |

选好服务商后，接口地址和默认模型会自动填入，粘贴 API Key 即可。无法直接访问海外 API 时，可使用中转站：服务商选 **自定义**，填入中转站提供的 Key、接口地址与模型名。

---

## ✦ 数据管理

- **本地优先**：浏览器 IndexedDB，完全离线可用；登录后增量同步到云端。
- **导出 / 导入**：Data 页一键导出 / 导入全站 JSON 备份。
- **存储**：API 密钥仅存本机（及服务端加密库），代码仓库不含任何密钥。
- **⚠ 备份建议**：清除浏览器数据或换浏览器将丢失本地副本，请定期在 Data 页导出。

---

## ✦ 设备兼容性

需支持 IndexedDB、CSS backdrop-filter、ES6+ 的现代浏览器（Android / iOS / 桌面浏览器均可）。

---

## ✦ Introduction (EN)

**Internal Beyond · Mobile** is a personal AI companion app designed to preserve emotional continuity — local-first storage, cloud sync after login, with AI keys held only on the server.

### Features

- **Home** — Pseudo-iOS launcher: Desk (app grid + calendar / notes / schedule / music widgets) and Space (liquid-glass profile card used as AI context).
- **Lock** — iOS-style passcode lock with wallpaper; config stored locally only, recoverable via security question.
- **Chat** — Multi-API streaming conversations with thinking chain, attachments, web search, action cards, summaries, memory generation.
- **Circle** — Shared social feed where you and authorized AIs post, comment, reply, repost, and proactively care.
- **Calendar** — Anniversaries, birthdays, plans and reminders; AIs read upcoming items and mention them naturally.
- **Blog / Letters** — Journal with AI comments & annotations plus a password diary; asynchronous AI correspondence with wax-sealed envelopes.
- **Memory / Auto Memory** — Long-term emotional memory with context injection; per-AI autonomous dossiers about you.
- **Music** — Vinyl-style fullscreen player with scrolling lyrics and cross-device "Listen Together".
- **ICode** — Shared file workspace with AI read/write and a built-in GitHub bridge (browse, import, push back).
- **Visual / DIY / API / Data** — Full visual customization with 4 preset slots; external HTTP tools & MCP servers; multi-endpoint API center; one-tap JSON backup.

### Quick start

```bash
npm install
npm run dev
# open http://localhost:5173 → register / login → add your AI API key
```
