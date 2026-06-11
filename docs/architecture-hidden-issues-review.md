# 架构与隐性问题审查跟踪

> 创建时间：2026-06-11  
> 范围：多 agent 只读审查结果、本地交叉检查、当前未提交 simul-efun workspace 分区修复。  
> 目标：记录所有已发现问题，并作为后续修复状态真源，避免依赖聊天上下文。

## 状态说明

- `Open`：尚未修复。
- `In Progress`：已有部分修复，但未完成验证或未覆盖全部路径。
- `Blocked`：需要外部信息或前置修复。
- `Done`：代码与测试均已完成。

## 发布阻断

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| A01 | Done | P0 | CI 完整 Jest 当前失败 | `npm test -- --runInBand` 已通过，144 个 test suite / 1135 个测试全绿 | 后续 CI 继续作为发布门槛 |
| A02 | Done | P0 | simul-efun workspace 分区修复只覆盖诊断路径 | 已将 document 贯穿 completion、completion resolve、signature fallback 与 definition fallback；聚焦测试通过 | 后续全量回归继续验证 |

## 架构边界

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| B01 | Done | P0 | Header owner prefix 分析可能污染真实 owner 语义缓存 | prefix document 已使用隔离 cache key，同时保留真实 `fsPath` 供 include 解析；新增真实 cache 回归测试 | 长期仍建议合入 semantic/project index，避免 owner service 自建上下文 |
| B02 | Done | P1 | Header owner 在生产路径递归扫 `.c` 并重新推断 include | owner 发现已拆到 `HeaderOwnerIndexService` 预热 `ProjectSymbolIndex` 反向 include owner 关系；`HeaderOwnerContextService` 只查询索引并基于唯一 owner prefix 生成上下文；focused header owner、装配与 spawned runtime 回归通过 | 后续新增 `.h` owner 能力继续通过 project index 查询，不在 Provider/Context 层自建 owner 扫描 |
| B03 | Done | P1 | include / inherit 解析没有稳定使用 mudlib root | diagnostics、definition、hover、signature help 与函数文档 lookup 已携带 workspace projectConfig；include/inherit 缓存按 projectConfig 分区，新增导航与文档 lookup 回归测试 | 后续新增路径解析入口必须继续接收 request workspace context |
| B04 | Done | P1 | LSP spawned runtime 存在 workspace config 双真源 | spawned runtime 装配已移除底层 `LpcProjectConfigService` fallback，document shim 携带 `WorkspaceSession` projectConfig；diagnostics、completion、hover、definition、signature help 均传递同一配置；focused spawned runtime 与语言能力回归通过 | 后续新增 LSP 主路径能力必须从 request workspace context 派生项目配置 |

## 诊断与预处理

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| C01 | Done | P1 | include directories 被当成全局已 include 宏来源 | `LpcFrontendService` 已删除 configured include dir 全局宏扫描；include dirs 只在显式 `#include` 解析时参与搜索 | 若未来需要 preinclude/global include，应单独建模而不是复用 include dirs |
| C02 | Done | P1 | 依赖符号缓存可能旧签名压过新签名 | `ProjectSymbolIndex` 允许 same-version rebuilt snapshot 覆盖旧记录；diagnostics 合并顺序优先本轮递归 fresh dependency | 保持 degraded snapshot 不覆盖有效记录 |
| C03 | Done | P2 | `macroReferences` 被当作全文件 known name，`#undef` 后会漏报 | `BasicSemanticDiagnosticsCollector.isKnownName` 现在只在当前 identifier range 与 macro reference range 相等时放行 | 后续若做完整宏可见性，可进一步按位置维护宏环境 |
| C04 | Done | P2 | function-like 宏只支持整行展开 | `MacroExpansionBuilder` 已支持表达式级 `NAME(...)` token 范围展开，保留整行声明宏路径；无法解析的调用仍由基础语义诊断保守抑制 undefined 类噪声；frontend macro 与 diagnostic collector 回归通过 | 后续若支持跨行宏调用，再扩展 inline invocation parser |
| C05 | Done | P2 | frontend include 解析与 project config include dirs 两套逻辑 | frontend `IncludeResolver` 与 `WorkspaceDocumentPathSupport` 已共用 `resolveIncludePathCandidates`，项目根、系统 include dirs、mudlib 绝对 include 与相对 include 的候选规则保持一致；include/pathSupport/spawned runtime 回归通过 | 后续新增 include 规则先改共享 resolver，再由 frontend/pathSupport 消费 |

## LSP 与功能一致性

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| D01 | Done | P1 | completion / completion resolve / signature fallback 对 simul-efun 仍依赖 active workspace | `rg` 未再发现生产路径无上下文 `getAllSimulatedFunctions()` / `getSimulatedDoc(name)` 调用；聚焦测试通过 | 保留无 document API 仅作兼容入口，主路径不再依赖 |
| D02 | Done | P2 | workspace config sync 失败可能让 LSP diagnostics 永久停在 not-ready | sync handler 已用 `finally` 恢复 ready 状态并释放 pending/open diagnostics；失败路径测试覆盖 | 保留错误日志，避免配置刷新失败导致后续诊断永久停摆 |
| D03 | Done | P3 | extension host scanFolder 与 LSP 实时 diagnostics 启用条件不一致 | host 与 LSP 现在共用 `shouldRunProjectDiagnostics`；无项目配置时 LSP refresh 发布空诊断且不运行 collector | 后续新增诊断入口继续复用该策略 |

## 测试与发布卫生

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| E01 | Done | P1 | Jest 分组脚本会空跑或覆盖不足 | `test:unit` / `test:integration` 指向现有测试；未配置 e2e/performance 时明确失败 | 后续若新增 e2e/performance，再替换为真实 test target |
| E02 | Done | P1 | efun arity audit 未接入 CI，缺 FluffOS checkout 时成功退出 | audit 脚本新增 `--strict`；CI checkout FluffOS 并运行 `audit:efun-arity:strict` | 本地普通 audit 仍可在缺 checkout 时跳过 |
| E03 | Done | P2 | package 路径重复 build 且 `vsce` 未锁版本 | `@vscode/vsce` 已锁为 devDependency；package 脚本交给本地 `vsce package` 触发 `vscode:prepublish` | 避免 `npx` 临时版本与重复 build |
| E04 | Done | P2 | VSIX 包含 production sourcemap 和 `sourcesContent` | production esbuild 不再生成 sourcemap；VSIX 内容继续由 package `files` 白名单控制 | 后续打包验证继续检查 VSIX 内容 |
| E05 | Done | P3 | VS Code engine 与 `@types/vscode` 版本/依赖位置不一致 | `@types/vscode` 已移入 devDependencies 并对齐 `^1.82.0` | 若提升 engine，再同步提升 types |
| E06 | Done | P3 | 仓库跟踪本地/临时文件 | `.claude/settings.local.json`、`temp-package.json` 已从 git index 移除并加入 ignore | 本地文件保留，不再随仓库提交 |
| E07 | Done | P3 | 版本与 changelog 边界不清 | 本轮未发布修复写入 `Unreleased`，未修改版本号 | 发布前再决定是否 bump |

## 修复顺序

1. 先处理 A01/A02/D01：保证 CI 与用户已遇到的 simul-efun 误报不再反复。
2. 再处理 B01/B03/B04：去掉最危险的 URI 缓存污染和 project root 分叉。
3. 然后处理 C01/C02/C03/C04/C05：收敛预处理与诊断强度。
4. 最后处理 E01-E07/D02/D03：补齐工程、CI、打包与策略一致性。

## 验证门槛

- 每个修复批次至少有针对性 Jest 覆盖。
- 全部完成前必须通过：
  - `npm test -- --runInBand`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run package`
- 涉及 efun 文档或 arity 时额外运行：
  - `npm run audit:efun-arity`
