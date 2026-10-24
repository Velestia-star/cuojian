# 更新日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## v0.1.0 — 2026-10-24

第一个能日常自用的版本。目标不是功能多，而是把「记录 → 排队 → 复习 → 结束」这条闭环做对。

### 新增

- **纯函数内核**：`rng`（mulberry32）、`shuffle`（Fisher–Yates）、`grade`（选择题集合判等 + 填空归一化）、`scheduler`（冷却 + 尾部窗口重插）、`stars`、`positional`（位置相关选项识别）。
- **数据层**：Repository 接口、Dexie(IndexedDB) 实现、内存实现；9 张表按 R11 建好。
- **练习引擎**：整池打乱开轮、答错自动重排、答对二选一、三种结束条件、进度口径。
- **界面**：题库列表、录入表单（选择题 / 填空题）、作答页、结算页；CSS Modules 响应式布局。
- **持久化**：队列写回 `queue_item` + `setting`，退出再进接着刷，不重新打乱。
- **撤销**：划去 5 秒内可撤销；未选择就退出按「保留」恢复。
- **工程**：TypeScript strict、Vitest + fast-check、GitHub Actions CI。

### 已知限制

- 没有导出/导入备份，清浏览器数据会丢题库。
- 题库列表未做虚拟滚动。
- 未做 PWA 与 Android 打包。
