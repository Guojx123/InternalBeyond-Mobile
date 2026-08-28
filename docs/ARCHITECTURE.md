# ARCHITECTURE.md — InternalBeyond-Mobile 全栈架构

本文档描述 InternalBeyond-Mobile 重构后的**全栈架构**：前端 Vite 5 + React 18 + TypeScript，后端 Node.js + Express 4 + TypeScript，数据库 MongoDB Atlas + Mongoose。

> 重构目标（经确认）：全服务端化（AI 代理 + 云同步 + 社交后端）+ 账号制（JWT）+ **保留本地优先** + 一次性全量重写。
> 当前进度：脚手架、后端骨架、前端壳层、同步引擎已就绪；Home / Chat / Data 已可运行，其余模块为带主题的占位页（见末尾迁移状态表）。

---

## 1. 总览

```
浏览器(React)  ──本地缓存(Dexie/IndexedDB, 离线优先)──┐
      │  HTTPS API (JWT)                               │ 同步引擎
      └────────────────►  Express 后端  ───────────────┘
                         ├─ AI 代理(流式转发 Claude/GPT/DeepSeek/Gemini)
                         ├─ 同步 CRUD (SYNC_STORES 各集合)
                         ├─ 社交(Circle 动态/评论/转发, 多用户人↔AI)
                         ├─ 外部工具(MCP/HTTP, GitHub PAT)
                         └─ MongoDB Atlas (Mongoose, 按 userId 隔离)
```

**核心原则**
- 数据以 **MongoDB 为准（按用户隔离）**；浏览器保留 **IndexedDB 本地缓存** 用于离线可读/弱网。
- 联网时由前端**同步引擎**与后端双向同步（last-write-wins）。
- AI Key 仅存服务端（AES-256-GCM 加密），浏览器永不接触明文密钥。

---

## 2. 仓库布局（monorepo / npm workspaces）

```
/
├─ frontend/                # Vite 5 + React 18 + TS  → Render Static Site
│  ├─ index.html, vite.config.ts, tsconfig.json, package.json
│  └─ src/
│     ├─ main.tsx, App.tsx           # 入口 + 路由 + 登录门禁 + 壳层
│     ├─ styles/                     # tokens.css(设计令牌) + base.css(液态玻璃/双主题)
│     ├─ lib/                        # apiClient, db(Dexie), sync(引擎), stream(SSE), storeNames, modules
│     ├─ context/                    # AuthContext, ThemeContext
│     ├─ components/                 # GlassCard, TopBar, Drawer, ThemeToggle
│     └─ modules/                    # 按模块拆分（Home/Chat/Data 已实现，其余 StubPage）
├─ backend/                # Node + Express 4 + TS  → Render Web Service
│  ├─ package.json, tsconfig.json, .env.example
│  └─ src/
│     ├─ index.ts                    # express 入口 + 路由挂载 + CORS + 自保活
│     ├─ config/                     # env, db(连接 Mongo)
│     ├─ middleware/                 # auth(JWT + requireDb), error
│     ├─ models/                     # User, ApiConfig, ApiSettings, SyncDoc, Post, Tool
│     ├─ routes/                     # health, auth, sync, ai, social, tools
│     ├─ services/                   # aiProxy(流式), lib/crypto(加密)
│     └─ lib/                        # storeNames(SYNC_STORES), crypto
├─ render.yaml             # 双服务声明（后端 Web Service + 前端 Static Site）
└─ README.md / DEPLOY.md / docs/
```

---

## 3. 后端

| 关注点 | 实现 |
|--------|------|
| 框架 | Express 4 + TypeScript（`tsx` 开发，`tsc` 构建为 `dist/`） |
| 数据库 | Mongoose 连接 MongoDB Atlas；`bufferCommands=false` 避免断开时挂起 |
| 鉴权 | `jsonwebtoken` + `bcryptjs`；`requireAuth` 注入 `req.userId`；`/api/auth/register｜login｜me` |
| 密钥安全 | `lib/crypto.ts` AES-256-GCM；`ApiConfig._apiKeyEnc` 入库前加密、`select:false`、读取经 `getApiKey()` 解密 |
| AI 代理 | `services/aiProxy.ts`：按 provider 选择上游端点并**流式（SSE）**回传；支持 Claude / OpenAI 兼容 / Gemini |
| 同步 | `routes/sync.ts`：通用 `SyncDoc` 集合，按 `(userId, store, docId)` 增量 upsert / 拉取快照 / 删除 |
| 社交 | `routes/social.ts` + `models/Post`：动态含 `visibility`(all/self/allow/exclude) 过滤 |
| 外部工具 | `routes/tools.ts` + `models/Tool`：后端代发 HTTP/MCP（绕过浏览器 CORS），支持调用前确认 |
| 健康检查 | `GET /api/health` → `{ ok, mongo }`，作 Render 健康检查 |

### 数据模型（Mongoose，全部带 `userId` 隔离）
- `User`：邮箱 / 密码哈希 / 昵称
- `ApiConfig`：端口配置 + 加密密钥 + 权限 + 提示词（**密钥不回传前端**）
- `ApiSettings`：全局 AI 设置
- `SyncDoc`（通用）：覆盖 `SYNC_STORES` 的 13+ 命名空间 `{userId, store, docId, data, updatedAt}`
- `Post`：社交圈动态（可见范围）
- `Tool`：DIY 外部 HTTP / MCP 工具

`SYNC_STORES`：about, apiConfigs, chatMessages, chatThreads, chatSummaries, groups, uploadedFiles, memories, autoMemory, apiSettings, calEvents, calNotes, calLedger, posts, categories, letters, blogComments, blogAnnotations, projects, projectFiles, feed。

---

## 4. 前端

| 关注点 | 实现 |
|--------|------|
| 构建 | Vite 5 + React 18 + TS；`react-router-dom` 路由；开发期 `/api` 代理到 `:10000` |
| 设计系统 | `styles/tokens.css`（设计令牌 + 双主题变量）+ `styles/base.css`（液态玻璃、顶栏、抽屉，源自原 `index.html` 抽取） |
| 本地优先 | `lib/db.ts`（Dexie）：`sync` 表（复合主键 `[store,docId]`）镜像后端 SyncDoc；`kv` 表存纯本地偏好（主题等） |
| 同步引擎 | `lib/sync.ts`：写本地即入队推送；登录/`online` 事件拉取全量快照；last-write-wins；失败静默重试 |
| 状态 | `context/AuthContext`（登录门禁 + 拉取快照）、`context/ThemeContext`（Internal/Infernal，持久化到 `kv`） |
| 流式对话 | `lib/stream.ts`：调用 `/api/ai/chat` 并解析 SSE，逐 delta 回调（ChatPage 使用） |
| 组件 | `GlassCard / TopBar / Drawer / ThemeToggle`；模块注册表 `lib/modules.tsx` 供抽屉与桌面共用 |

### 模块页面
- **Home**（已实现）：Space 液态玻璃名片（读写 `about`） + Desk 应用矩阵（跳转） + Circle 占位。
- **Chat**（已实现）：会话线程（Dexie `chatThreads`）+ 消息（Dexie `chatMessages`）+ 调后端流式 AI 代理；Space 名片作为 system 上下文注入。
- **Data**（已实现）：一键导出 / 导入 Dexie 备份（与电脑端共用格式）+ 存储概览。
- 其余模块：已登记路由，当前为带主题的 `StubPage`，复用 `lib/db` + `lib/sync` 即可迁移。

---

## 5. 本地优先 + 同步策略

1. 任意写操作 → `localPut(store, docId, data)` 写 Dexie 并 `schedulePush` 入队。
2. 同步引擎 `flush()` 把队列按 store 归并，批量 `PUT /api/sync/:store`。
3. 登录或浏览器 `online` 事件 → `pullSnapshot()` 拉全量覆盖本地（last-write-wins，以 `updatedAt` 较大者胜出）。
4. 离线时本地可用；恢复网络自动 flush 未推送的变更。
5. 冲突目前采用 last-write-wins；如需更严谨可升级为版本向量 / 字段级合并。

---

## 6. 部署（Render）

见 `render.yaml` + `DEPLOY.md`：
- **后端 Web Service**：`rootDir: backend`，`build: npm install && npm run build`，`start: npm start`，健康检查 `/api/health`，环境变量 `MONGODB_URI / JWT_SECRET / ENCRYPTION_KEY / FRONTEND_URL / SELF_PING_URL`。
- **前端 Static Site**：`rootDir: frontend`，`build: npm install && npm run build`，`staticPublishPath: ./dist`，全部路由回退 `index.html`，环境变量 `VITE_API_URL` 指向后端。
- MongoDB Atlas 作为外部服务，连接串写入 `MONGODB_URI`。

---

## 7. 模块迁移状态

| 模块 | 状态 | 说明 |
|------|------|------|
| Home | ✅ 已实现 | Desk / Space / Circle 卡片 |
| Chat | ✅ 已实现 | 流式对话 + 线程 + 同步 |
| Data | ✅ 已实现 | 备份导出/导入 |
| API | ✅ 已实现 | 多端口配置中心（密钥服务端加密，不回传） |
| Memory | ✅ 已实现 | 记忆库（情感坐标 V/A/I）+ Auto Memory 档案（读写 SYNC_STORES） |
| Circle | ✅ 已实现 | 社交圈（动态发布 / 可见范围 / 删除，调后端 /api/social） |
| Calendar | ✅ 已实现 | 月历视图 + 纪念日/生日/计划/备忘 + 重复规则（calEvents 同步） |
| Blog | ✅ 已实现 | 日志 + 分类 + 密码日记本 + AI 留言展示（新增 `blog` 同步 store） |
| Letters | ✅ 已实现 | 邮局：写信投递 + 火漆拆信 + 信箱（letters 同步） |
| Music | ✅ 已实现 | 黑胶播放器 + LRC 歌词滚动 + 播放队列 + 一起听占位（本地） |
| ICode | ✅ 已实现 | 项目/文件工作区 CRUD + 编辑器 + GitHub PAT 直连列仓库/导入 |
| Visual | ✅ 已实现 | 全站主色 + 字号缩放 + 4 方案槽（本地 kv） |
| DIY | ✅ 已实现 | 外部 HTTP/MCP 工具 CRUD + 后端代发运行（/api/tools） |
| Lock | ✅ 已实现 | 密码锁屏 + 壁纸（本地 kv）+ 启动锁屏门禁 |
| Guide | ✅ 已实现 | 模块总览 + 快速上手 |

**全部 11 个模块已迁移完成，无 `StubPage` 占位。**

---

## 7b. 本阶段增强（AI 生成 / 社交 / ICode / 样式）

- **Memory · AI 主动生成**：`MemoryPage` 新增 AI 端口选择 + 「AI 提炼坐标」「从聊天提炼」。`completeChat()`（`frontend/src/lib/ai.ts`，复用 SSE 流式累积）读取 Space 名片（`about` 本地库）作为上下文，把一段时刻或最近 24 条聊天提炼成 `{content, valence, arousal, importance}` 并回填滑块，确认后存入。新增 `spaceContext()` 拼装名片上下文。
- **Letters · AI 代笔**：选定接收 AI 后「AI 代笔」以该 AI 口吻、结合用户名片生成 `{subject, body}` 并回填，可改后投递。
- **Circle · 社交评论 / 转发**：
  - 后端 `Post` 模型新增 `comments[]`（authorType/authorName/text/createdAt）与 `repostOf`；`routes/social.ts` 新增 `POST /posts/:id/comment`、`POST /posts/:id/repost`（转发以用户身份建新动态并引用源）。`GET /posts` 已含评论与转发标记。
  - 前端 `CirclePage` 每条动态下展示评论、评论输入框，并提供「🔁 转发」按钮（可带附言）。
- **ICode · AI 读写 + 一键推回 GitHub**：
  - 编辑器接入 AI：**选择端口 → 输入指令 →「AI 改写」**，`completeChat` 按指令重写文件内容（保存后落库）。
  - 导入仓库时记录 `project.gh{repo,branch}` 与每个文件 `gh.path`；「推回」经 GitHub Contents API（`GET` 取 `sha` + `PUT` base64 内容）逐文件提交到原分支；PAT 仍仅存本地 `kv`。
- **样式对齐液态玻璃**：重写 `frontend/src/styles/tokens.css`——玻璃卡增加内高光/渐变与深度阴影，按钮分 primary(辉光)/danger/默认三态含 hover/active，`body` 改为径向渐变背景；补全 `.li/.li-main/.li-name/.li-side/.cn/.comment/.fld` 等此前缺失的通用类（Music/ICode/Circle 复用）。

## 7c. 本阶段继续增强（社交 AI 互动 / 锁屏密保 / 柔光氛围）

- **社交圈 AI 自动互动（服务端）**：`services/aiProxy.ts` 新增非流式 `completeChat(config, messages, opts)`（支持 Claude / OpenAI 兼容 / Gemini 三种响应解析）。`routes/social.ts` 新增 `autoReact(postId, userId)`：发帖后（用户动态）异步让该用户已配置的 AI 端口各接一句话评论（`comments[]` 的 `authorType:'ai'`），并暴露 `POST /posts/:id/ai-react` 手动触发；全程 `try/catch` 容错、依赖 `mongoConnected` 守卫，不阻塞主响应。前端 `CirclePage` 每条动态新增「🤖 让 AI 互动」按钮，AI 评论已随 `comments[]` 自然渲染。
- **锁屏密保问答（本地）**：`LockPage` 可设置密保问题与答案（存本地 `kv` `lockQA`）；`LockScreen` 在密码错误时提供「忘记密码？」入口，答对密保即解锁。仍为纯本机、不进同步/备份。
- **柔光氛围样式**：`tokens.css` 为 `body` 增加一层缓慢呼吸的极光光晕（`body::before` + `@keyframes aurora`），并为 `.card` 增加 hover 抬升与辉光过渡，强化液态玻璃的层次与灵动感。

## 7d. 本阶段继续增强（字体 fidelity / AI 主动来信）

- **视觉细节进一步对齐（字体）**：`index.html` 通过 Google Fonts 引入 `Cormorant Garamond`（标题衬线）、`Raleway`（disp）、`Noto Sans SC` / `Noto Serif SC`（CJK 回退）、`IBM Plex Mono`（代码），使此前仅声明的 `--serif/--disp/--monoP` 真正生效；`tokens.css` 新增 `.glass/.card` 的斜向游走高光（`::after` + `@keyframes sheen`，并对 `prefers-reduced-motion` 关闭），更贴近原 index.html 的液态反光。
- **Letters · AI 主动来信**：`LettersPage` 新增「✉️ 收 TA 的来信」——以选中 AI 的口吻、结合用户名片，`completeChat` 生成一封 `{subject,body}` 并作为**火漆密封**信件（`fromId` 标记、投进本地信箱），用户点击才拆。信箱行现区分「TA → 我」与「我 → AI」。

## 7e. 本阶段继续增强（AI 主动定时关怀 / 卡片入场）

- **AI 主动定时关怀**：新增后端 `routes/care.ts`（`POST /api/care/trigger`，挂在 `/api` 下、自动受 `requireDb` 守卫）。用 `completeChat` 让该用户配置的第一个 AI 端口，在「仅自己可见」圈子发一条温柔短句（`authorType:'ai'`）。前端两处触发：① `CirclePage` 的「🤍 让 TA 主动关怀」手动按钮；② `App` 在登录后每日首次打开自动触发（`kv` 记录 `lastCareAt`，20 分钟内不重复），模拟「定时关怀」——无持久 cron 也能在打开 App 时自然出现 TA 的惦记。
- **卡片入场过渡**：`tokens.css` 为 `.card` 增加 `cardIn` 淡入上移动画（并对 `prefers-reduced-motion` 关闭），配合既有 hover 抬升与玻璃游走高光，进一步贴近原 index.html 的灵动入场。

## 7f. 本阶段继续增强（ICode「一起听」跨端）

- **后端聆听房间**：新增 `models/ListenRoom.ts`（每位用户一个 `userId` 唯一房间：`track/position/playing/by` + `updatedAt` 时间戳）与 `routes/listen.ts`（`GET /api/listen` 取状态、`POST /api/listen` 上报/覆盖，挂在 `/api` 下自动受 `requireDb` 守卫并注册于 `index.ts`）。
- **前端跨端同步**：`MusicPage` 将占位式「一起听」升级为真实跨端——开启后启动 2s 轮询拉取房间状态，仅在 `updatedAt` 更新且非本机设备写入时应用（按曲名匹配本地曲库并 `seek` + 跟随播放/暂停）；播放中每 4s 上报当前进度，控制动作（播放/暂停/切歌/拖动）即时上报。设备标签存 `kv` `deviceLabel`，房间内显示「与 <by> 同步中」。用 `liveRef` 避免轮询闭包捕获过期播放状态。受本地音频文件限制，跨端同步的是**播放光标与状态**（两端需各自存有该曲目）。

## 7g. 同步质量加固（逐条 LWW 合并）

- **前端 `pullSnapshot` 改为逐条 last-write-wins**：拉取快照时按 `(store,docId)` 比对本地与服务端 `updatedAt`，仅当服务端更新才覆盖本地；登录前离线编辑（本地时间戳更新）得以保留，并在登录后 `flush()` 推回。同时把服务端下发的 `updatedAt`（ISO 字符串）统一归一为 epoch ms 存储，消除此前字符串/数字混用导致比较不可靠的隐患。
- **登录/注册后补推离线编辑**：`AuthContext` 在 `pullSnapshot()` 之后调用 `flush()`，把无 token 期间入队但未发出的本地变更推回服务端（此前这些 job 会滞留队列，直到下次编辑才偶然发出）。
- **后端 `PUT /api/sync/:store` 同步 LWW**：写入前先取该文档当前 `updatedAt`，若传入版本更旧则跳过（`continue`），避免"离线旧编辑 flush 覆盖云端新编辑"的竞态，使服务端与客户端语义一致。

## 7h. 删除同步（墓碑机制）

- 原删除是硬删除：服务端 `deleteOne` 后，其它设备拉快照时不会收到该 docId，导致**删除无法跨设备传播**（B 端本地副本永久残留，甚至可能因编辑而"复活"回服务端）。
- 改为**墓碑（tombstone）**：`SyncDoc` 增加 `deleted: boolean` 字段；`DELETE /api/sync/:store/:docId` 不再硬删，而是 `updateOne({ $set: { deleted: true, updatedAt } })`（带 `upsert`，对尚未上云的记录也留痕）。`GET /api/sync` 与 `GET /api/sync/:store` 在快照中携带 `deleted`。
- 前端 `pullSnapshot` 见到 `deleted` 的远端记录即删除本地副本（本地已无则跳过，避免每次拉取重复请求）；普通记录仍走逐条 LWW 合并。由此删除也能按"最后操作时间"在设备间胜出——若某端在删除之后又编辑了同条，其更晚的 `updatedAt` 会让编辑保留（LWW），符合直觉。

---

## 8. 本地运行

```bash
cp backend/.env.example backend/.env   # 填 MONGODB_URI / JWT_SECRET / ENCRYPTION_KEY
npm install
npm run dev                            # 并发起 backend(:10000) + frontend(:5173)
# 打开 http://localhost:5173 → 注册/登录 → 数据自动拉取与同步
```
