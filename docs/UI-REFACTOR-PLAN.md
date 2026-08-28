# InternalBeyond-Mobile — UI 重构计划

> 目标：将当前 Vite+React+TS 前端重做成对齐参考 PWA（`InternalBeyond-Mobile-main/`）的 iOS 液态玻璃风格全量界面。
> 约束（已与用户确认）：① 只重构前端 UI，不动后端/数据层；② 保留现有极光渐变背景（不替换模糊照片背景）；③ 设计 token 从参考 PWA 重新提取。
> 执行方式：按阶段分批交付，每批结束可运行、可通过 `npm run typecheck`。
> 底部 Dock 主 Tab（默认）：**Home / Chat / Circle / 菜单(☰ 开 Drawer)**。

---

## 0.0 现状基线（避免与既有工作重复）

- 当前 `styles/tokens.css` / `base.css` 已具备较成熟的液态玻璃体系（见 `ARCHITECTURE.md §7b–7h`）：玻璃内高光/渐变、`.card` 入场 `cardIn`、`.glass::after` 游走高光 `sheen`、`body::before` 极光呼吸、字体已接入 `Cormorant Garamond/Raleway/Noto/IBM Plex Mono`，并已补 `.li/.fld/.cn/.comment` 等通用类。
- 因此本计划**不是从零重做**，而是：① 修补已知缺陷（`--soft` 未定义、变量重复、`.glass` 未变量化、冗余主题类）；② 抽取 `components/ui/` 共享组件消除各页内联样式；③ 引入底部 Dock + 图案锁等缺失外壳；④ 将各页视觉**对齐参考 PWA（`InternalBeyond-Mobile-main/`）做精修**。执行时应复用既有 `.card/.glass/.li` 等类，勿另起一套。
- 审核代码时另核实到以下**缺陷与死代码**，一并纳入阶段 0/1 修补：
  - `meta-theme-color` 无 id：`index.html:6` 只有 `<meta name="theme-color">`（无 `id`），`ThemeContext.tsx:32` 的 `getElementById('meta-theme-color')` 恒为 `null` → 切主题时浏览器状态栏颜色从未更新（真 bug，§1.4 会修）。
  - 暗色背景被 base.css 覆盖：`base.css:40` 的 `body.theme-infernal{background:#141a2e}`（import 顺序靠后）盖掉 `tokens.css:76` 的暗色径向渐变 → Infernal 当前是纯色底，暗色极光渐变一直没生效。去重时删 base.css 纯色行、保留 tokens 渐变。
  - tokens.css 与 base.css **重复定义**：`.fld/input/textarea/select`（tokens:178 vs base:342）、`.muted`（tokens:248 vs base:336）、`*` 重置与 scrollbar（两处）——阶段 0 统一去重，选一个文件为准（建议控件收进 tokens，布局收进 base）。
  - `MusicPage` 内嵌 `<style>{@keyframes spin…}</style>` 每次渲染注入（`MusicPage.tsx:309`）→ `spin` 等动效迁入 base.css。
  - `VisualPage` 设置的 `--ui-scale` 无消费方（死代码），字号缩放实际靠 `document.body.style.fontSize`（`VisualPage.tsx:14-15`）。
  - 原生周边控件未统一：Blog 密码日记 `type=checkbox`、Visual `type=color`、Calendar `type=date` 仍是系统外观（见 §0.2 备注）。
- 模块注册表 `lib/modules.tsx` 已有 `MODULES`（15 项，含 `glyph`），Dock / Drawer / 桌面图标应统一读取，避免图标漂移。

---

## 0. 基础：设计系统 + 共享组件

### 0.1 重新提取 `tokens.css`
文件：`frontend/src/styles/tokens.css`
- `:root`（明亮）与 `body.theme-infernal`（暗）补齐参考完整变量，新增：
  `--soft`、`--think`、`--think-line`、`--sheet`、`--scrim`、`--ibBlur:20px`、`--ibSat:1.55`
  （当前 `--soft` 被 `HomePage.tsx:42` / `ChatPage.tsx:161` 引用却未定义，导致头像/气泡透明）。
  - `.glass` 改为 `backdrop-filter: blur(var(--ibBlur)) saturate(var(--ibSat))`，为 visual 的 blur 滑块预留。当前 `tokens.css:86-87` 写死 `blur(20px) saturate(1.55)`，改为引用变量。注：参考仅把 `--ibBlur` 变量化（`index.html:405`，且只在 `.cv-head.glass::before` 等使用、`:root` 兜底 20px），`--ibSat` 是本计划的自定义扩展，语义与参考写死的 `saturate(1.55)` 一致。
  - 删除 `base.css:35-38` 在 `body` 上重复的 `--serif/--disp/--sys/--monoP`，**保留 `tokens.css:21-24`（`:root`）唯一一份**。注意：原计划把两处并列易误删正确源，本节只删 base.css 的重复项。
  - **双文件选择器去重**：合并 tokens.css 与 base.css 中重复的 `.fld/input/textarea/select`、`.muted`、`*` 重置与滚动条定义（见 §0.0 缺陷清单）；**删除 `base.css:40-42` 的 `body.theme-infernal{background:#141a2e}` 纯色行**，让 `tokens.css:76-78` 的暗色径向渐变生效（当前被覆盖）。
  - **保留** `body::before` 极光背景，不替换为参考的模糊照片背景。
  - `--soft` 缺失影响 5 处（非仅 2 处）：`HomePage.tsx:42`（头像兜底）、`ChatPage.tsx:161`（用户气泡）、`CalendarPage.tsx:119`（日格事件点）、`MusicPage.tsx:187`（唱片中心）、`VisualPage.tsx:58`（预览块）。取值**从参考重提**（`index.html:91/102`）：明亮 `rgba(255,255,255,0.32)` / 暗 `rgba(24,33,58,0.42)`。因本项目保留极光渐变背景（参考是照片+遮罩），若目测白软块过实，可对该透明度微调，但**色相走参考**（白→蓝，不用半透明钢蓝）；验收以 §4 五处不再透明为准。

### 0.2 新增共享组件库 `frontend/src/components/ui/`
解决库存问题：大量内联 style、输入样式不一致、使用 `alert()`/`prompt()`。
- `Input` / `Textarea` / `Select`：统一 `.fld` 外观（修掉 blog/circle/letters/memory/icode/api/chat 的裸 `border:1px`）。
- `Slider`：自定义范围滑块（替换 memory/visual 原生 range）。
- `Toggle`：iOS `.sw2` 风格开关（41×23 药丸）。
- `Chip`：999px 标签（blog/calendar 复用）。
- `Avatar`：圆形头像，glyph/initial 兜底 + 描边光环（修透明 `--soft` 头像问题）。
- `Modal` / `Sheet`：底部抽屉 `.sheet` / 对话框 `#dlg`（letters 弹层、circle 转发、blog 阅读视图统一）。
- `Toast`：替换 data/lock/circle 的 `alert()`/`prompt()`。
- `SectionTitle`：已存在，沿用。
- **周边原生控件**（不入共享库，但阶段 0 在 base.css 统一玻璃外观）：`input[type=color]`（visual）、`type=date`（calendar）、`type=file`（music/data 隐藏式已 OK）、`type=checkbox`（blog 密码日记，重皮时改 `Toggle`）。统一 `-webkit-appearance`、padding、圆角与 `--line` 边框，避免三处仍旧是系统控件观感。Music 内嵌 `<style>` 的 `@keyframes spin` 一并迁入 base.css。

---

## 1. 外壳与导航

1. **底部 Dock** — 新增 `frontend/src/components/BottomDock.tsx` + `base.css`
   - 固定底部玻璃药丸（`border-radius:20px`，高 ~58px，含 `var(--sab)` 安全区），参考 `#dock`/`.dock-i`：flex 等分 tab，图标 + 0.6rem 标签，选中态 `--acc`+发光。选中判定用 `useLocation().pathname` 前缀匹配 `DOCK_TABS[].path`（与 `App.tsx:97` 同法），随路由实时更新。
   - `lib/modules.tsx` 加 `DOCK_TABS` 常量，默认主 Tab = **Home / Chat / Circle / 菜单(☰ 开 Drawer)**；其余 **12** 模块（calendar/blog/letters/memory/music/icode/visual/diy/lock/api/data/guide）仍由 Drawer 全量进入（维持「Desk 网格即全部应用」心智）。Dock 与 Drawer 图标统一取自 `MODULES[].glyph`，避免两端不一致。
   - `App.tsx` 移除右下悬浮 `⌂`（`App.tsx:133`），常驻渲染 `<BottomDock onGo={(to) => to === 'drawer' ? setDrawer(true) : navigate(to)} />`；TopBar 左键 ☰ 继续开 Drawer。drawer state 仍在 Shell，BottomDock 经 prop 回调复用同一状态，不另起抽屉实例。
   - 布局兼容：`base.css:291` 的 `main { padding-bottom: calc(96px + var(--sab)) }` 已为 Dock 预留（58px 高 + 10px 底边距 ≈ 68px < 96px），无需改动。

2. **子页侧滑转场** — `base.css` 加 `subIn`（`translateX(104%)→0`，0.32s，`prefers-reduced-motion` 关闭）；`App.tsx` 用 `useLocation().pathname` 作 key 包 `<Routes>`。**范围界定（修正原稿矛盾）**：`<Routes key={pathname}>` 只能作用于**路由级切换**，因此 `subIn` 统一套在所有一级路由（/home、/chat、/circle + 12 模块之间互切）上；**模块内二级视图**（blog 阅读、letters 拆信、circle 转发层、memory 详情）是组件内 state 渲染，不受 Routes key 影响，走各自 `Modal`/`Sheet` 转场、**不再叠加 subIn**。原稿把"Dock 四主 Tab 切换"与"/home→/chat 一级路由"同时列为"要 subIn 又不要 subIn"，矛盾，按本解释执行。

3. **锁屏图案锁** — 重写 `frontend/src/components/LockScreen.tsx`（参考 `#lockscr`）
   - 3×3 canvas 连线图案盘 + 液态玻璃提示胶囊 + 上滑解锁 + 壁纸背景；密保找回保留。
   - **存储约定（与 LockPage 联动，非仅 LockScreen）**：`lockPass` 兼容两种值——纯数字（≥4 位，老式数字锁）与图案串（`1-9` 节点按下顺序，短横连接，如 `1-2-5-8-9`）。LockScreen 判定：读到的值含 `-` 或非纯数字 → 图案模式，否则数字模式。`LockPage` 保存侧须同步改造（图案设置写入 `lockPass` 图案串并覆盖旧数字），此改动超出"纯重皮"，须纳入阶段 1 一并交付，避免新图案落盘后旧 LockScreen 无法识别。
   - **LockPage 需新增图案设置 UI**：现 `LockPage` 只有数字输入框（`LockPage.tsx:56`），图案模式没有入口——须在密码卡内加入小型 3×3 图案设置盘（抽取 LockScreen 的连线绘制逻辑为共享 `PatternPad` 组件，两侧复用），否则用户无法产生图案串、计划 §1.3 的存储约定悬空。

4. **主题对齐** — `frontend/src/context/ThemeContext.tsx:29-34` + `index.html`
   - 暗色仅切 `theme-infernal`、明亮用 `:root` 默认，去掉多余 `theme-internal` 类（grep 确认无 CSS 消费它，纯清理）。
   - **修 `meta-theme-color` 失效**：给 `index.html:6` 的 `<meta name="theme-color">` 补 `id="meta-theme-color"`，否则 `ThemeContext.apply` 的 `getElementById` 恒为 `null`，状态栏颜色从未随主题切换（现状 bug 见 §0.0 缺陷清单）。

---

## 2. 15 个模块页面内部重构

> 原则：保留现有业务逻辑/数据流，仅替换视觉为参考风格，并迁入 §0.2 共享组件。

### Tier A — 导航/枢纽
- **home** (`modules/home/HomePage.tsx`)：Desk/Space/Circle 三面板（底部 Dock 子段或分段控件切换）。
  - Desk：模块玻璃瓦片网格 + 挂件行（月历/便笺/日程/音乐 mini）。
  - Space：液态玻璃名片（封面渐变 + 头像 + 简介 + 作品集三图 + AI 数提示），修掉误用 `Empty` 作 CTA。
  - Circle：AI 名片卡网格（头像/签名/Auto Memory）替代占位。
- **guide** (`modules/guide/GuidePage.tsx`)：入门引导卡 + 编号步骤 + 模块总览网格，重排为参考风格 hero+网格（最低复杂度）。

### Tier B — 通讯
- **chat** (`modules/chat/ChatPage.tsx`)：全屏对话，玻璃 `cv-head`（端口选择+标题+菜单）与 `cv-input`（发送）；气泡左右带 4px 尾 + 头像；用共享 `Input` 替换裸 textarea/select。流式逻辑保留，仅重皮。**scope 校准**：当前 Msg 只有 `{role,content}`，无思考链/操作卡/附件字段——原稿"思考链可折叠、操作卡（折叠）、附件+联网开关"对应的是参考完整版，属**功能重写且需后端能力（矛盾于不动后端）**。本计划只做：思考链/操作卡片仅在 Msg 数据携带时渲染的样式占位（现状无数据不造 UI），附件/联网开关不实现。线程列表/端口选择样式对齐 `#cv-selbar` 相关参考即可。
- **circle** (`modules/circle/CirclePage.tsx`)：发布卡（可见范围 Chip + 配图 + 定位）；动态卡（作者头像/可见徽标/配图/评论线程/转发/AI 回应/删除）；转发改用 `Sheet` 弹层替 `prompt()`。
- **letters** (`modules/letters/LettersPage.tsx`)：写信卡（收件人/主题/正文/AI代笔·收信·投递）；信箱网格用**火漆印章 SVG** 信封瓦片（密封🔥/已拆态）；读信用玻璃 `Modal`，emoji 印章换 SVG 火漆。

### Tier C — 内容/创作
- **blog** (`modules/blog/BlogPage.tsx`)：分类 Chip；写卡（标题/正文/分类/密码日记开关+密码）；条目卡 + 阅读视图 `Modal`；**补上缺失的评论输入 UI**；AI 批注展示。密码日记改用共享 `Toggle`（现为原生 checkbox），分类标签迁入共享 `Chip`。scope 校准：评论数据（`blogComments` store）已在且当前有渲染，只缺评论输入 UI，可补；`blogAnnotations`（AI 段落批注）store 已在 `SYNC_STORES` 但 `BlogPage` 从未渲染——"AI 批注展示"即补这段渲染，写入/编辑批注超出纯重皮、不做。
- **calendar** (`modules/calendar/CalendarPage.tsx`)：全屏 `#cvcal`，吸顶玻璃 `cvcal-bar`（月份导航），hero 相遇纪念卡；7 列日格（玻璃格+事件点+选中高亮，移除裸 inline）；事件卡（类型·重复徽标，纪念日用 `--gold`）；新增表单。
- **memory** (`modules/memory/MemoryPage.tsx`)：写卡（端口选择/AI提炼/三个 `Slider` 效价·唤醒·重要性，映射 2D 情感坐标散点）；记忆列表（内容+坐标徽标）；Auto Memory 分区（每 AI 卡：六分类·三级优先）。原生 range 换 `Slider`。
- **music** (`modules/music/MusicPage.tsx`)：页内 hero 黑胶播放器：`.glass` 旋转碟片 + 封面、**封面糊化为背景**；逐句滚动歌词（活动行高亮）；玻璃控制条；队列 `.li`（播放指示）；一起听卡。逻辑保留。**数据缺口**：当前 `Track` 无封面字段（唱片盘只是 `--soft` 占位圆），"封面糊化"需要封面来源——在本地会话对象 `Track` 补本地只读 `cover`（object URL/dataURL，选曲可附带），不进 Dexie/同步，符合"不动数据层"；同时把 `MusicPage.tsx:309` 内嵌 `@keyframes spin` 迁入 base.css。"全屏黑胶"收敛为**页面内沉浸 hero**（不 fixed 全屏遮罩），避免与 Dock/TopBar 打架。
- **icode** (`modules/icode/ICodePage.tsx`)：双栏在窄屏改为单列堆叠（可用 `@media (max-width:560px)` 切 `1fr`，`grid-template-columns` 现为 `1fr 1fr`；若坚持 Tab 堆叠需维护 curFile/选中项目在 Tab 间的状态往返，成本更高，先按单列验收）；项目+文件 `.li`；编辑器卡（AI端口+提示+改写+保存+推 GitHub）；GitHub 区（PAT/仓库 `.li`/导入）。修双栏溢出（`ICodePage.tsx:227`），编辑器走共享样式。

### Tier D — 设置/工具
- **api** (`modules/api/ApiPage.tsx`)：端口卡列表（头像/昵称/模型/删除）；新增/编辑表单走共享 `Input`/`Select`；逐项权限用 `Toggle`。
- **diy** (`modules/diy/DIYPage.tsx`)：加工具卡（名称/URL/HTTP·MCP `Toggle`/调用前确认 `Toggle`）；工具卡（运行/删除）；结果 `<pre>` 玻璃代码块。轻量重皮+共享输入。
- **visual** (`modules/visual/VisualPage.tsx`)：主色选择器 + 字号 `Slider` + 4 方案槽网格；滑块/开关走共享组件。**主色机制修正**：现 `applyVisual` 把 `--acc` 写在 `document.documentElement` 内联（`VisualPage.tsx:13`），但暗色下 `body.theme-infernal{--acc:#72a8d8}` 是更近祖先声明 → **自定义主色在暗色主题里被覆盖、不生效（仅明亮主题有效）**。改为引入 `--acc-custom`：`:root` 与 `body.theme-infernal` 分别写成 `--acc: var(--acc-custom, 默认值)`，Visual 只设 `--acc-custom` 一处，亮/暗两套同时生效，并保留"关闭自定义即回默认"语义。顺带确认 §0.0 缺陷清单的 `--ui-scale` 死代码在此页清理。
- **lock** (`modules/lock/LockPage.tsx`)：启用 `Toggle`；**密码卡改为「数字锁 / 图案锁」二选一**（图案设置盘复用 §1.3 的共享 `PatternPad`，写入 `lockPass` 图案串并存 `lockMode` 提示位）；密保卡；壁纸网格用更丰富的渐变/预览瓦片；`alert()` 换 `Toast`（`LockPage.tsx:25/27/30/32`）。注意：图案设置入口属于阶段 1 的 LockScreen 联动改造一部分，LockPage 不宜拖到阶段 5 才做。
- **data** (`modules/data/DataPage.tsx`)：备份卡（导出/导入/刷新 + `Toast` 替换 `alert`，`DataPage.tsx:36/42`）；存储总览改统计网格（各 store 计数）；**Token 用量仪表盘（简单柱状）**——scope 校准：后端现**无** token 用量记录（`aiProxy.ts` 未统计 usage），此子项需要后端新增用量上报/查询接口，属"不动后端"约束外；先降级为按 `chatMessages` 条数/端口的本地柱状近似，并标注「UI 骨架 + 本地近似，待后端用量接口接入」。另 `importBackup` 的 `JSON.parse` 无 try/catch（坏文件会抛未捕获异常），顺带加固。
- **guide** 见 Tier A。

---

## 3. 改动文件清单

| 类型 | 文件 |
|------|------|
| 重写 | `frontend/src/styles/tokens.css`、`frontend/src/styles/base.css` |
| 重写 | `frontend/src/components/LockScreen.tsx`、`frontend/src/App.tsx` |
| 重写 | `frontend/src/context/ThemeContext.tsx`、`frontend/src/lib/modules.tsx` |
| 新增 | `frontend/src/components/BottomDock.tsx` |
| 新增 | `frontend/src/components/ui/{Input,Textarea,Select,Slider,Toggle,Chip,Avatar,Modal,Sheet,Toast}.tsx` |
| 新增 | `frontend/src/components/ui/PatternPad.tsx`（3×3 连线绘制，LockScreen 与 LockPage 复用） |
| 重皮 | `frontend/src/modules/{home,guide,chat,circle,letters,blog,calendar,memory,music,icode,api,diy,visual,lock,data}/<Name>Page.tsx` |

> 附注：`LockPage` 的保存逻辑随图案锁联动改造（§1.3 存储约定），不属纯重皮，改动随阶段 1 交付；`BottomDock` 经 `App.tsx`（Shell）回调复用 drawer state，`App.tsx` 为既有文件上的"重写+新增接入面"。

---

## 4. 验证

- `npm run typecheck` 通过。
- `npm run dev` 打开 `:5173`：
  - 底部 Dock 切换四主 Tab、子页滑入、暗/亮主题切换；
  - 锁屏图案锁、头像/气泡 `--soft` 不再透明；
  - 主题回归**新增项**：Infernal 背景恢复暗色径向渐变（base.css 纯色行已删）；浏览器状态栏颜色随主题切换（`meta-theme-color` 补 id 后首次生效）；
  - 抽查：chat 气泡尾/头、calendar 日格、letters 火漆信封、music 黑胶+封面糊化背景、memory 滑块、各页输入统一外观、无 `alert/prompt`（music <style> 注入已清、icode 窄屏不再双栏溢出）。

### 4b. 风险与验收补充

- **动效无障碍**：所有新增动画（`subIn`/`cardIn`/极光/sheen）必须包裹 `@media (prefers-reduced-motion: reduce)` 关闭，沿用 `tokens.css:144` 既有约定。
- **主题回归**：`ThemeContext` 删除 `theme-internal` 类后，需回归确认明亮态仍由 `:root` 默认承载、`theme-infernal` 暗色分支保留；补 id 后确认 `meta-theme-color` 随主题正确更新（暗 `#141a2e` / 亮 `#dfe9f6`）。
- **共享组件迁移顺序**：Tier B/C/D 页面改造前，`components/ui/` 必须先在阶段 0 落地，否则会出现"组件未定义"的 typecheck 失败。各页改造只替换 DOM 结构与 className，业务逻辑（Dexie/SSE/同步引擎调用）原样保留。
- **图标一致性**：Dock/TopBar/桌面图标三处统一读 `MODULES[].glyph`，新增图标只改 `modules.tsx` 一处。
- **无后端耦合**：本计划任何改动不得引入对 Express/Mongoose 的新依赖；`LockScreen` 兼容旧 `lockPass`（数字）与新图案串，防止老用户无法解锁。
- **每模块交付粒度**：模块重皮为最小交付单元——改完即 `npm run typecheck` + 目测该模块（桌面网格/Drawer 图标不漂移、无 `alert/prompt`、输入外观一致、无 inline 裸边框），通过后再进下一模块，避免阶段尾部集中返工。
- **主 Tab 联动回归**：BottomDock 落地后回归「非主 Tab 模块（如 /calendar）当前高亮落在 ☰」；点击 Home 图标回 /home 后高亮恢复 Home —— 选中态必须随 pathname 更新，不得停留旧 tab。

### 4c. 参考对齐审计表（重皮时逐项对照 `InternalBeyond-Mobile-main/index.html` 勾选）

| 交付物 | 参考元素 | 验收点 |
|--------|----------|--------|
| BottomDock | `#dock`/`.dock-i`（L362-372） | 药丸底栏、8 段 flex 等分、图标+0.6rem 标签、`.on` 用 `--acc`+发光、暗色图标转蓝白 |
| LockScreen | `#lockscr`（L1680-1744） | 居中大字时钟、上滑胶囊 `.lk-home`、3×3 图案盘 `.lk-padpanel`、密保 `.lk-sq`、壁纸 `.lk-wall` |
| Toggle | `.sw2`（L322-326） | 41×23 药丸、`.on` 背景 `--acc`、滑块 left 3↔20px、点击区放大 |
| Chat | `.cv-head`/`.cv-input`（L404-405）/`#cv-selbar`（L813） | 对话顶栏/输入栏玻璃、气泡尾 4px+头像、线程/端口选择对齐 `#cv-selbar`、思考链/操作卡仅数据携带时渲染 |
| Calendar | `#cvcal`+`.cvcal-bar`（L575-593） | 全屏月历、吸顶玻璃条、7 列日格、`--soft` 事件点、选中高亮、纪念日 `--gold` |
| Sheet/Modal | `.sheet`（L955）/`#dlg`（L971） | 底部抽屉/居中对话框与 Dock·Drawer 玻璃外观一致 |
| Letters | 火漆信封/`#dlg` | 拆信 Modal、火漆 SVG 印章替换 emoji、信箱瓦片 |
| Memory | 原生 range → Slider | 效价/唤醒/重要性滑杆、情感坐标散点、Auto Memory 六分类 |
| Music | 封面糊化/逐句歌词/队列 | 碟片旋转、封面做背景、活动行高亮、`.li` 队列、一起听卡 |
| ICode | 双栏/`.li`（L213） | 窄屏单列堆叠、编辑器玻璃样式、GitHub 区、`<pre>` 代码块 |

---

## 5. 不在范围

后端（Express/Mongoose）、IndexedDB/Dexie 数据模型与同步逻辑、账号体系、模糊照片背景替换、PWA service worker（参考已有独立 `ib-sw.js`，可后续独立接入）。

---

## 6. 执行阶段顺序

1. **阶段 0 — 基础**：重写 `tokens.css`（补 `--soft` 等 + `.glass` 变量化 blur）、新增 `components/ui/` 共享组件库。
2. **阶段 1 — 外壳与导航**：底部 Dock + `DOCK_TABS`、子页侧滑转场、图案锁屏重写（含 `LockPage` 图案设置 UI 与存储格式联动改造，共用 `PatternPad`）、`ThemeContext` 对齐（`meta-theme-color` 补 id）。
3. **阶段 2 — Tier A**：home、guide
4. **阶段 3 — Tier B**：chat、circle、letters
5. **阶段 4 — Tier C**：blog、calendar、memory、music、icode
6. **阶段 5 — Tier D**：api、diy、visual、lock、data

---

## 附录 A. 评审修订记录

> 三轮回溯性评审（对照 15 个模块仓库源码逐一核实），以下修订均已落实到正文。

| # | 位置 | 评审结论 | 修订动作 |
|---|------|----------|----------|
| 1 | §0.1 `--soft` | 原建议值偏离"从参考重提" | 改取参考值 亮`rgba(255,255,255,.32)`/暗`rgba(24,33,58,.42)`，保留透明度微调权 |
| 2 | §0.1 字体变量 | 原句把 `:root` 正确源与 `body` 重复项并列，会误删 | 明确只删 `base.css:35-38`，保留 `tokens.css:21-24` 唯一一份 |
| 3 | §0.1 `.glass` | `--ibSat` 参考未变量化 | 注明为自定义扩展；修正 `.glass` 行号 86-87 |
| 4 | §1.1 底部 Dock | 选中态/抽屉联动/布局兼容未写明 | 补 pathname 前缀匹配、`onGo` 回调复用 Shell drawer state、`main` padding 兼容说明 |
| 5 | §1.2 subIn | 原稿同一操作既"要动效"又"不要动效"，矛盾 | 定为路由级统一套 subIn；模块内二级视图走 Modal/Sheet 不叠加 |
| 6 | §1.3 + §2 lock | 只有存储约定，无图案写入入口 | 补 LockPage 图案设置 UI + 共享 `PatternPad` + 阶段 1 提前交付 |
| 7 | §1.4 主题 | `meta-theme-color` 无 id，状态栏颜色从未更新（真 bug） | 补 id，并列入验证 |
| 8 | §2 chat | 思考链/操作卡/附件=功能重写且需后端 | scope 校准：仅数据携带时渲染样式占位；`#cv-sel`→`#cv-selbar` |
| 9 | §2 music | 无封面数据源、"全屏"与壳层冲突 | Track 补本地 cover（不进 Dexie/同步）、hero 页内化、`@keyframes spin` 迁 base.css |
| 10 | §2 blog | 密码日记 checkbox、`blogAnnotations` 从未渲染 | checkbox→Toggle、分类→Chip；"AI 批注展示"=补渲染，写入不做 |
| 11 | §2 visual | 主色写 root 内联 → 暗色主题被 `body.theme-infernal` 覆盖失效 | 引入 `--acc-custom`，亮/暗两套同时生效；清理 `--ui-scale` 死代码 |
| 12 | §2 data | Token 仪表盘无后端数据源；导入 JSON.parse 未防护 | 降级本地近似+标注待接口；补 try/catch |
| 13 | §2 icode | Tab 堆叠需维护跨 Tab 状态，成本高于收益 | 改用 `@media (max-width:560px)` 单列堆叠 |
| 14 | §0.0/0.2 | 漏核 6 项缺陷/死代码 | 新增缺陷清单（暗色渐变被 base.css 覆盖、双文件重复选择器、Music `<style>` 注入、`--ui-scale`、原生控件未统一、meta id 缺失） |
| 15 | §4/4b/4c | 验收与对照不足 | 新增"主 Tab 联动回归"、"每模块交付粒度"、Infernal 渐变回归、参考对齐审计表（Dock/Lock/Toggle/Chat/Calendar/Sheet/Letters/Memory/Music/ICode 对参考 L 行号逐一勾选） |
