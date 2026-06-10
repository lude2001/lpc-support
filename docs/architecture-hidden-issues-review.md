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
| B02 | In Progress | P1 | Header owner 在生产路径递归扫 `.c` 并重新推断 include | `HeaderOwnerContextService` 已改为通过 `WorkspaceDocumentPathSupport.findWorkspaceSourceFiles()` 使用 host 文件搜索，不再自建同步递归；仍会扫描候选 `.c` 并读 include | 长期把 owner/include 可见上下文移动到 semantic/project index 层，Provider 只查询索引 |
| B03 | In Progress | P1 | include / inherit 解析没有稳定使用 mudlib root | diagnostics resolver 已携带 workspace projectConfig 解析 include/inherit，`resolveInheritedFilePath` 支持 mudlib root；navigation 等路径仍需复核 | 继续让 projectConfig/mudlibRoot 贯穿所有递归解析入口 |
| B04 | In Progress | P1 | LSP spawned runtime 存在 workspace config 双真源 | LSP diagnostics request 已携带 `WorkspaceSession` projectConfig，配置同步失败不再卡住诊断；其它服务仍需复核是否重读磁盘配置 | LSP server 内选一个配置真源，优先由 `WorkspaceSession` snapshot 驱动项目配置 |

## 诊断与预处理

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| C01 | Done | P1 | include directories 被当成全局已 include 宏来源 | `LpcFrontendService` 已删除 configured include dir 全局宏扫描；include dirs 只在显式 `#include` 解析时参与搜索 | 若未来需要 preinclude/global include，应单独建模而不是复用 include dirs |
| C02 | Open | P1 | 依赖符号缓存可能旧签名压过新签名 | `ProjectSymbolIndex` 用 version 判断跳过更新；recursive fresh symbols 排在 cached symbols 后 | 诊断路径强制刷新依赖或用内容 hash/mtime；fresh symbols 优先 |
| C03 | Open | P2 | `macroReferences` 被当作全文件 known name，`#undef` 后会漏报 | `BasicSemanticDiagnosticsCollector.isKnownName` 按名字放行 macro references | macro reference 只按 range 判断当前 token；宏可见性按位置判断 |
| C04 | Open | P2 | function-like 宏只支持整行展开 | `MacroExpansionBuilder.tryExpandWholeLineInvocation` 只处理整行调用 | 长期补 token 级 function-like expansion；短期对未展开位置降级，避免强诊断 |
| C05 | Open | P2 | frontend include 解析与 project config include dirs 两套逻辑 | `LpcFrontendService` 的 `IncludeResolver` 没拿到项目 include dirs；diagnostics pathSupport 另有解析 | 统一 include/path resolver，frontend 与 diagnostics 共用同一项目配置 |

## LSP 与功能一致性

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| D01 | Done | P1 | completion / completion resolve / signature fallback 对 simul-efun 仍依赖 active workspace | `rg` 未再发现生产路径无上下文 `getAllSimulatedFunctions()` / `getSimulatedDoc(name)` 调用；聚焦测试通过 | 保留无 document API 仅作兼容入口，主路径不再依赖 |
| D02 | Done | P2 | workspace config sync 失败可能让 LSP diagnostics 永久停在 not-ready | sync handler 已用 `finally` 恢复 ready 状态并释放 pending/open diagnostics；失败路径测试覆盖 | 保留错误日志，避免配置刷新失败导致后续诊断永久停摆 |
| D03 | Open | P3 | extension host scanFolder 与 LSP 实时 diagnostics 启用条件不一致 | host 要求 `lpc-support.json`；LSP 只等 config sync ready | 抽共享 diagnostics enable policy |

## 测试与发布卫生

| ID | 状态 | 严重度 | 问题 | 证据 | 修复方向 |
| --- | --- | --- | --- | --- | --- |
| E01 | Open | P1 | Jest 分组脚本会空跑或覆盖不足 | `test:unit`、`test:e2e`、`test:performance` listTests 为 0 | 改为 Jest projects、明确匹配规则，或删除误导脚本 |
| E02 | Open | P1 | efun arity audit 未接入 CI，缺 FluffOS checkout 时成功退出 | `scripts/audit-efun-arity.mjs` 缺 spec 时 `exit(0)` | 加 strict/CI 模式；CI checkout FluffOS 或显式跳过说明 |
| E03 | Open | P2 | package 路径重复 build 且 `vsce` 未锁版本 | `vscode:prepublish` 与 `package` 都 build；`npx @vscode/vsce` 未固定 | 固定 devDependency，打包脚本只保留一个 build 入口 |
| E04 | Open | P2 | VSIX 包含 production sourcemap 和 `sourcesContent` | `dist/**/*.map` 被 `files` 包入 | 发布版关闭 sourcemap 或从包中过滤 map |
| E05 | Open | P3 | VS Code engine 与 `@types/vscode` 版本/依赖位置不一致 | engine `^1.82.0`，types `^1.95.0` 且在 dependencies | types 移到 devDependencies，并对齐最低 engine 或提升 engine |
| E06 | Open | P3 | 仓库跟踪本地/临时文件 | `.claude/settings.local.json`、`temp-package.json` | 后续从 git 移除并更新 ignore |
| E07 | Open | P3 | 版本与 changelog 边界不清 | `Unreleased` 为空，当前未提交修复写入 `0.47.10`，同版本 VSIX 已存在 | 后续发布时明确是否 bump；未发布内容优先放 `Unreleased` |

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
