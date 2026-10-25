# 错笺 CuoJian

把错题记下来、排好队、反复磨。**本地优先**：无账号、不联网、无统计，数据只在你自己的浏览器里。

> 背答案没用，因为选项顺序骗了你。错笺每次作答都重新打乱选项，正确答案按**选项身份**判定；
> 答错的题自动回到队列后方，隔几道再出现；答对的题由你决定「保留」还是「划去」。

当前版本：**v0.1.0（M1–M2）**，一个能自己每天用的最小闭环。

---

## 快速开始

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dev        # 开发服务器
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 生产构建（产物在 dist/）
```

> 本机 Node 不在 PATH 上时，用绝对路径：`D:\node.js\npm.cmd run dev`。
>
> **Windows 用户**：直接双击根目录的 `启动.cmd`。它会自动找 Node（含
> `D:\node.js`、`C:\Program Files\nodejs` 等常见位置）、缺依赖时自动 `npm install`、
> 启动后自动打开浏览器；关掉那个黑窗口就停止服务。失败时窗口会停住并告诉你原因。
>
> ⚠️ 从 GitHub 下载 ZIP 的**非开发者**：本机运行需要先装 [Node.js 18+](https://nodejs.org/)。
> 不想装环境就直接用在线版：<https://wei238982377.github.io/cuojian/>（功能完全一样，数据存在你自己浏览器里，不联网上传）。

### 发布到 GitHub Pages

推上 GitHub 后，在仓库 **Settings → Pages → Source** 里选 **GitHub Actions**，
之后每次 push 到 `main`，`.github/workflows/pages.yml` 会自动跑测试、构建并部署。
构建用 `base: './'` + `HashRouter`，所以子路径 `/cuojian/` 下刷新不会 404。

---

## v0.1 做了什么

| 规则 | 实现情况 |
| --- | --- |
| R1 选择题 / 填空题 | ✅ 录入表单支持两种题型；选择题 2–8 个选项 |
| R2 答案存选项 id | ✅ `option.isCorrect` + `correctOptionIds` 由选项行推导，不存字母 |
| R3 每次作答洗牌一次 | ✅ 进入作答态时 `shuffleOptions()` 一次，字母按渲染顺序现算 |
| R4 位置相关选项锁定 | ✅ 录入时自动识别「以上都对」等，整题 `shuffleLocked` |
| R5 答错计星并重排 | ✅ `wrongCount+1`、`stars=min(5,wrongCount)`、自动重新排队、900ms 后自动下一题 |
| R6 答对二选一 | ✅ 「保留在错题集」/「划去」 |
| R7 尾部窗口重插 | ✅ `window = max(3, ceil(0.25 × 剩余题数))` |
| R8 冷却间隔 | ✅ `gap = max(5, ceil(0.15 × 剩余题数))`，池子不足时排到队尾 |
| R9 星数不参与调度 | ✅ 调度函数签名里没有 stars，有专门的不变量测试 |
| R10 填空归一化判定 | ✅ NFKC → 删零宽 → 空白 → 大小写 → 句末标点；严格/宽松、大小写分别开关 |
| R11 数据表 | ✅ question / option / answer / card / attempt / session / tag / setting / queue_item |
| R12 队列持久化 | ✅ 每次作答后写回 `queue_item` + `setting`，重进接着刷，不重新打乱 |
| R13 一轮可结束 | ✅ 队列空 / 用户点结束 / 50 题上限，三种终点都进结算页；进度常显 |
| R14 零网络 | ✅ 无任何网络请求、无第三方 SDK、无统计 |
| R15 划去可撤销 | ✅ 软删除 `archivedAt`，5 秒内可撤销；没选就退出按「保留」恢复 |
| R16 编辑不破坏历史 | ✅ 题目 `revision` 递增、选项软删除、attempt 只追加 |

### v0.1 明确没做

- CSV / 批量导入、图片题（这是录入成本的真正杀手，留到下一版）
- 标签、统计图表、复习提醒
- PWA 安装、Capacitor 套壳 APK、iOS
- 导出 / 导入备份（**重要**：清浏览器数据会丢题库，见「已知限制」）
- 「练到一半改题目」的编辑页（数据结构已就位，界面没做）

---

## 行为约定

### 一轮怎么走

```
开始练习 → 整池打乱（最多取 50 道）
      ↓
   取队首作答
      ├─ 答错 → 星数 +1 → 按冷却 + 尾部窗口插回队列 → 短暂反馈 → 自动下一题
      └─ 答对 → 二选一
              ├─ 保留 → 插回队列（同样受冷却约束）
              └─ 划去 → archivedAt 软删除，5 秒内可撤销
      ↓
 队列空 / 点「结束本轮」/ 已做 50 题 → 结算页
```

- 进度用 `已作答 / (已作答 + 队列剩余)`，所以 A 模型下数字不会倒挂。
- 同一轮里被重新插回的题不会立刻出现：至少要隔 `max(5, ceil(0.15 × 剩余))` 道。
- 池子不够长时，冷却会让位，题目排到队尾——`I2` 的边界就是这样定义的。

### 不变量与测试

| 不变量 | 落点 |
| --- | --- |
| I1 取走的题不会同一轮立即重插 | `src/core/scheduler.test.ts` 长跑用例 |
| I2 冷却间隔 | `src/core/scheduler.test.ts`（含池子不足排队尾） |
| I3 尾部重插位置随机且不总在最后 | 200 个种子断言下标集合 > 1 |
| I4 洗牌前后正确选项 id 集合不变 | `src/core/shuffle.test.ts` |
| I5 星数不改变调度 | `pickNext` 签名 + fast-check 属性测试 |
| I6 划去后不再出题、历史保留、可恢复 | `src/app/store.test.ts` |

---

## 架构

```
src/
├─ core/        纯函数：rng / shuffle / grade / scheduler / stars / positional（零 UI、零 DB 依赖）
├─ db/          Repository 接口 + Dexie 实现 + 内存实现（测试用）
├─ features/    练习引擎：开轮、答错重排、答对二选一、结束条件
├─ app/         Zustand store、组合根（唯一读真实时间/随机源的地方）
├─ components/  通用组件（选项列表、进度条、撤销条、编辑器…）
├─ pages/       题库 / 录入 / 作答 / 结算
└─ styles/      全局变量与基础样式（CSS Modules，无 Tailwind）
```

三个刻意的设计：

1. **业务层只认 `Repository` 接口**，组件不许直接调 Dexie。以后换 SQLite 只加一个实现。
2. **随机与时间全靠注入**：`Rng` 是 mulberry32，`now` 是 `() => number`，测试用假时钟 + 固定种子。
3. **`core/` 只放纯函数**，任何依赖 UI 或数据库的代码都不许进来。

更多取舍写在 [`docs/DECISIONS.md`](docs/DECISIONS.md)。

---

## 测试

```bash
npm test
```

覆盖重点：

- Fisher–Yates 分布均匀（8 选项 × 20000 次，容差 ±0.02）、同种子可复现、不修改入参
- 选择题集合判等、漏选/多选/空选判错
- 填空归一化：全角、零宽、空白、大小写开关、句末标点、幂等性、`1/2 = 0.5`、`15 ≠ 1.5`
- 调度：`gap`/`window` 公式、重插区间、池子不足排队尾、随机性、3000 次长跑不变量
- store：队列持久化、答错重排、答对保留/划去、撤销恢复（I6）、跨进程默认保留（R15）

---

## 已知限制

- **没有导出备份**。清浏览器缓存 / 换浏览器 = 题库消失。这是 v0.2 的第一优先级。
- 题库列表一次性读全表，题库上千条后会卡，需要虚拟列表 + 分页。
- 作答页刷新会重新洗一次选项（已提交的答案不会丢，因为作答记录是作答那一刻落库的）。
- 只做了浅色主题，深色留到后面。
- 没有 E2E（Playwright 留到有稳定 UI 之后再补，先保证纯函数与 store 的测试绿）。

---

## 路线图

- [x] 纯函数内核 + 调度不变量测试
- [x] 题库列表 / 录入表单 / 作答闭环 / 结算页
- [x] 队列持久化、划去撤销
- [ ] 导出 / 导入 JSON 备份（v0.2 第一件事）
- [ ] 批量导入 CSV、题干配图
- [ ] 题目编辑页（保留 revision 与 attempt 历史）
- [ ] 标签与筛选、星数总览
- [ ] PWA 安装 + 离线缓存
- [ ] Capacitor 套壳 Android（`com.cuojian.app`）

---

## 数据与隐私

- 所有数据存在浏览器 IndexedDB（库名 `cuojian`），不经过任何服务器。
- 没有账号、没有遥测、没有崩溃上报、没有广告 SDK。
- 以后打包成 Android 时不申请 `INTERNET` 权限（R14）。

---

## 贡献

欢迎 issue 和 PR。动手前请先开 issue 对齐范围；PR 需要 `npm run typecheck`、`npm test`、`npm run build` 全绿。

不要提交：`node_modules/`、`dist/`、任何签名文件（`*.keystore` / `*.jks`）、真实题库数据。

---

## 许可证

[MIT](LICENSE)。允许商用与再分发；如果你打算把改进版原样打包上架，也请保留原项目链接。
