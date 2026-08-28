# DEPLOY.md — InternalBeyond-Mobile 部署与本地运行指南

本文说明**重构后的全栈版本**（前端 Vite + React + TS，后端 Express + TS + Mongoose，数据库 MongoDB Atlas）如何部署上线，以及本地运行方式。

> 若你需要部署「旧版单文件静态应用」，见历史 README 与 `docs/项目简介文档.md`，本文件面向当前 monorepo 全栈结构。

---

## 一、部署到 Render（推荐）

仓库已附带 `render.yaml`，声明**两个服务**：后端 Web Service + 前端 Static Site。连接 GitHub 仓库后 Render 自动按此部署。

### 1. 后端（Web Service）

在 Render 新建 **Blueprint** 或手动新建 Web Service，指向 `backend` 目录：

- **Runtime**：Node
- **Root Directory**：`backend`
- **Build Command**：`npm install && npm run build`
- **Start Command**：`npm start`
- **Health Check Path**：`/api/health`
- **环境变量**：
  - `MONGODB_URI` — MongoDB Atlas 连接串（必填）
  - `JWT_SECRET` — 强随机串（`openssl rand -hex 32`）
  - `ENCRYPTION_KEY` — 32 字节十六进制（`openssl rand -hex 32`），用于加密 AI Key
  - `FRONTEND_URL` — 前端域名（CORS 白名单）
  - `SELF_PING_URL` — 可选，填后端自身 `/api/health` 地址实现免费实例自保活
  - `PORT` — Render 自动注入（默认 10000）

### 2. 前端（Static Site）

- **Runtime**：Static
- **Root Directory**：`frontend`
- **Build Command**：`npm install && npm run build`
- **Publish Directory**：`dist`
- **Routes**：`/*` → `/index.html`（SPA 回写）
- **环境变量**：
  - `VITE_API_URL` — 后端地址，如 `https://ib-backend.onrender.com`（生产前端据此调用 API；开发期由 Vite 代理 `/api`）

部署完成后，打开前端地址即可注册/登录使用。

### 3. MongoDB Atlas

1. 创建免费 Cluster，建立 `internalbeyond` 数据库用户，白名单设为 `0.0.0.0/0`（或 Render 出口 IP）。
2. 复制连接串填入后端 `MONGODB_URI`。

---

## 二、本地运行（开发）

```bash
# 1. 准备后端环境变量
cp backend/.env.example backend/.env
#   编辑填入 MONGODB_URI / JWT_SECRET / ENCRYPTION_KEY（FRONTEND_URL 可留默认）

# 2. 安装依赖（monorepo 根目录一次装齐）
npm install

# 3. 并发启动前后端
npm run dev
#   后端:  http://localhost:10000   (tsx watch)
#   前端:  http://localhost:5173   (/api 代理到后端，免 CORS)
```

打开 `http://localhost:5173` → 注册账号 → 数据自动拉取快照并本地优先读写，联网时增量同步到云端。

### 不启动后端的前端预览

```bash
cd frontend && npm run dev    # 仅前端，未登录时显示登录页；登录需后端可用
```

---

## 三、数据模型与同步

- 数据以 **MongoDB 为准（按 userId 隔离）**，浏览器用 **IndexedDB（Dexie）** 做本地优先缓存。
- 同步引擎（`frontend/src/lib/sync.ts`）：写本地即入队推送；登录/`online` 事件拉取全量快照；冲突策略 last-write-wins。
- AI Key 仅存服务端（AES-256-GCM 加密），**密钥不进备份、不回传浏览器**（沿用原「密钥不进备份」理念）。
- 前端 **Data** 页可一键导出/导入本地备份（与电脑端共用格式）。

---

## 四、更新与回滚

- 更新代码后 Push 到 GitHub，Render 的 Web Service / Static Site 按 `render.yaml` 自动重建。
- 前端构建为静态资源，更新后刷新即生效（缓存策略联网优先）。
- 换设备/清浏览器前，请在前端 **Data** 页导出备份；清站点数据不影响云端（登录后仍可拉回）。

---

## 五、常见问题

- **后端健康检查 503 / `mongo:false`**：未配置 `MONGODB_URI`，同步/社交等功能不可用，但服务可启动、健康检查仍返回 200 外壳。
- **注册/登录 503**：同上，先配好 MongoDB。
- **前端调用 API 跨域**：开发期用 Vite `/api` 代理；生产期确保 `VITE_API_URL` 正确且后端 `FRONTEND_URL` 含前端域名。
- **AI 流式无响应**：检查 `ApiConfig` 的 `provider/baseUrl/aiModel` 与密钥是否正确；密钥仅后端可见。

---

## 六、目录与部署相关文件

```
frontend/   → Render Static Site (Vite + React + TS)
backend/    → Render Web Service (Express + TS + Mongoose)
render.yaml → 双服务声明
backend/.env.example → 环境变量模板
docs/ARCHITECTURE.md → 完整架构说明
```
