# 手动发布到 VS Code Marketplace

## 当前流程

日常 push / PR 运行 `.github/workflows/ci.yml`：测试、构建六个平台 VSIX，并在各平台运行包内的原生 sidecar smoke。它不登录或发布到市场。

正式发布使用单独的 **Publish to VS Code Marketplace** 工作流，只有 `workflow_dispatch` 手动入口。合并到 `main` 后，维护者在 Actions 中点击 **Run workflow**。

| 输入 | 用途 |
| --- | --- |
| `ci_run_id` | 已成功完成的 main 分支 CI 运行编号，是 Actions URL 中 `/runs/` 后的数字，不是 job ID |
| `version` | 包内已有的精确版本，例如 `0.52.19`；工作流不会改版本或生成 tag |
| `operation` | 默认 `verify`：仅核验；`identity`：登录后只读取发布身份 ID；`publish`：正式上传 |
| `resume` | 默认关闭。只有同一个 CI、同一个版本之前已经部分上传时才开启，用来跳过已存在的平台包 |

六个平台共享扩展身份 `ludexiang.lpc-support`，不是六个市场条目：

- `win32-x64` / `win32-arm64`
- `linux-x64` / `linux-arm64`
- `darwin-x64` / `darwin-arm64`

## 发布前检查

1. 按发布计划修改并提交 `package.json`、`package-lock.json` 中的版本及用户可见更新日志。已经存在的版本 / 平台不能用不同内容覆盖。
2. 通过 PR 合并到 `main`，等待 **Build and test** 以及六个 **Package ...** 全部成功。
3. 记录这一次 main CI 的运行编号和版本。PR CI 用于验收改动，不作为市场发布来源。
4. 先手动运行 `operation=verify`。核对 Summary 中的源提交、版本、六个平台和 SHA-256；这一步不需要 Azure 配置，不登录市场。
5. 完成下文的一次性发布身份配置后，再由维护者手动选择 `operation=publish`。

默认校验入口也可以通过 GitHub CLI 运行；它不会发布：

```bash
gh workflow run publish-marketplace.yml --ref main \
  -f ci_run_id=<successful-main-ci-run-id> \
  -f version=0.52.19 -f operation=verify -f resume=false
```

workflow 必须已经合并到默认分支才能在 Actions 显示手动入口。未合并的 PR 只执行 CI 测试，不触发 Marketplace 工作流。

## 一次性配置 Entra ID / GitHub OIDC

使用短期联合身份令牌，不保存发布 PAT 或客户端密钥。[VS Code 官方指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)已公告 Azure DevOps 全局 PAT 于 **2026-12-01** 退役。

以下配置由具有对应账号权限的维护者完成；仓库代码不会创建 Azure 资源、修改发布者成员或保存账号凭据。

### 1. 建立发布身份

在 Microsoft Entra 中建立应用注册及对应 service principal，记录 **Application (client) ID** 与 **Directory (tenant) ID**。也可以使用官方指南中的用户分配托管身份。不要创建长期客户端密钥。

为该身份添加 GitHub Actions 联合凭据：

| 字段 | 值 |
| --- | --- |
| Issuer | `https://token.actions.githubusercontent.com` |
| Audience | `api://AzureADTokenExchange` |
| Subject | `repo:lude2001/lpc-support:environment:vscode-marketplace` |

选择 GitHub 组织 / 用户 `lude2001`、仓库 `lpc-support`、实体类型 **Environment**、名称 **vscode-marketplace**，大小写必须一致。

参考：[GitHub 与 Azure OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-azure)、[Azure Login](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended)。工作流使用 `allow-no-subscriptions: true`，不要求为 Marketplace 发布提供 Azure subscription ID。

### 2. 配置 GitHub Environment

在仓库 **Settings → Environments** 建立 `vscode-marketplace`，将允许部署的分支限制为 `main`，添加 Environment secrets：

- `AZURE_CLIENT_ID`：上述 client ID。
- `AZURE_TENANT_ID`：上述 tenant ID。

这里保存的是身份标识，不是长期发布令牌。不要将这些值写进 YAML、源代码或聊天。

`id-token: write` 仅授予身份 / 正式发布 job；普通 CI 和默认 `verify` job 没有该权限。

### 3. 授予 Marketplace Publisher 权限

先用成功的 CI 编号与对应版本运行 `operation=identity`。它会核验六个包，执行 OIDC 登录，然后只读调用 Azure DevOps Profile API，将 **Marketplace identity resource ID** 写入 Summary。它不调用 `vsce publish`。

登录现有发布者 `ludexiang` 的 [管理页面](https://marketplace.visualstudio.com/manage/publishers/ludexiang)，将该 resource ID 对应的身份加入成员并授予 **Contributor**。resource ID 与 client ID、tenant ID 不是同一个字段。

若 Profile API 报身份未授权，按 VS Code 官方发布指南完成 Azure DevOps 的身份接入；不要用个人账号的 Profile ID 替代服务身份。`identity` 成功只说明能读取该身份，不代表已经获得 Publisher 的上传权限，仍需核对成员角色。

## 工作流具体核验什么

在任何上传发生之前，准备 job 会检查：

- 来源必须是本仓库 `ci.yml` 的 main push / 手动 CI，整个 run 已成功完成；拒绝 PR、其他分支、其他仓库和失败 / 未完成 run。
- 六个指定 artifact 均唯一存在、未过期、关联同一个源提交，并且下载 ZIP 的 SHA-256 与 GitHub 的 artifact digest 一致。
- 每个 artifact 仅包含该平台 / 版本的一个 VSIX；VSIX 的 XML、`package.json`、发布者、名称、版本和平台一致。
- 包内仅有对应的原生 sidecar 及校验文件，核对 PE / ELF / Mach-O 架构、二进制哈希，以及 Linux / macOS 的执行位。

全部通过后，原样保存六个 VSIX 和 `release-plan.json`，不重新构建。准备 job 将 release plan 的独立 SHA-256 作为 job output 传给后续 job，后续会再次核对 plan 和全部包的字节。

正式发布还会重新检查来源 CI 的 run attempt、artifact ID 和 digest，防止准备后被重新运行、替换或过期。任一检查失败均不调用发布工具。

发布工具使用锁文件中的 `@vscode/vsce`，安装依赖时禁用 lifecycle scripts，且在 OIDC 登录之前完成安装。上传使用 `vsce publish --packagePath ... --azure-credential`，不会运行 `vscode:prepublish`、重新编译、自动递增版本或创建 tag。

## 部分失败与补齐

六个平台按顺序上传，Marketplace 没有这里可用的六包原子事务。某个平台上传失败后停止，Summary 和 `publish-results.json` 会区分成功、失败、未尝试的平台；之前已成功上传的包继续存在。

补齐时重新手动运行，保持 **同一个 `ci_run_id`、同一个 `version`**，选择 `operation=publish` 并启用 `resume`。六个本地产物仍会全部核验，上传工具通过 `--skip-duplicate` 跳过已经存在的版本 / 平台组合。不能把其他 CI 的同版本包混入补齐；跳过已存在的包不等于重新证明市场上的包与当前文件逐字节一致，需核对原先的发布记录。

如果该版本曾被手动上传过不同内容，应停止并准备新版本。不要通过删除旧版本或强行覆盖来恢复这次流程。

GitHub artifact 默认保留 14 天，过期时预检会失败。需要重新跑 CI 生成完整六包，再用新的成功 run ID；若版本已部分发布，先核对重建结果与原发布计划，无法确认一致时使用新版本。

每次运行都有版本、源 SHA、CI 编号和每个平台哈希的 Summary；正式发布结果另存 artifact 30 天。最终发布仍需等待 Marketplace 完成服务端校验后核对市场页面，CLI 上传成功不等于所有客户端已经收到更新。

## 开发验收

```bash
npm run test:ci-tools
npm run test:rust-smoke
```

前者包括诊断通知交错回归与发布门禁、包校验、只读模式、部分失败和补齐测试；使用标准 Node / Python 测试设施，不访问市场。工作流 YAML 额外用 `actionlint` 核验。

本地只读核验使用 `scripts/marketplace_release.py prepare`，需要由环境提供有本仓库 `actions:read` 权限的 `GH_TOKEN` 或 `GITHUB_TOKEN`。不要打印令牌或写入报告。`verify` / `publish` 的只读模式还需要来源 run ID、version、head SHA 和来自可信准备阶段的 plan SHA-256。

脚本只有在 `--execute`、本仓库 main 的手动发布工作流以及事件中的 `operation=publish` 全部匹配时才允许调用上传工具。本地验收不伪造发布上下文、不调用实际上传、不改动真实 MUD 工作区。
