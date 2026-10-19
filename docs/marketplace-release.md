# 通过网页发布到 VS Code Marketplace

## 当前流程

GitHub 的 [CI 工作流](../.github/workflows/ci.yml)负责测试、构建六个平台的 VSIX，并在各平台运行原生 sidecar 的 stdio smoke。维护者下载这些包后，在 Marketplace 网页手动上传。

六个平台共享扩展身份 `ludexiang.lpc-support`，版本号保持一致：

| 平台 | 适用设备 | CI artifact 名称 |
| --- | --- | --- |
| `win32-x64` | Windows，Intel / AMD 64 位 | `lpc-support-win32-x64` |
| `win32-arm64` | Windows ARM64 | `lpc-support-win32-arm64` |
| `linux-x64` | Linux，Intel / AMD 64 位 | `lpc-support-linux-x64` |
| `linux-arm64` | Linux ARM64 | `lpc-support-linux-arm64` |
| `darwin-x64` | macOS，Intel | `lpc-support-darwin-x64` |
| `darwin-arm64` | macOS，Apple Silicon | `lpc-support-darwin-arm64` |

VS Code 会根据用户设备选择对应平台的包。平台标签由 `npm run package` 写入包内，下载后保留原始 VSIX 文件。

## 1. 准备版本

1. 更新 `package.json`、`package-lock.json` 中的版本，保持两者一致。
2. 在 `CHANGELOG.md` 记录相对上一版本的用户可见变更。CI、发布流程等维护事项写入开发文档。
3. 通过 PR 合并到 `main`，等待这次 main CI 的 **Build and test** 和六个 **Package ...** 全部成功。
4. 记录发布版本、源提交 SHA 和 CI 运行链接。

PR CI 用于验收改动，正式上传使用成功的 main CI 产物。

## 2. 下载六个平台包

1. 打开仓库的 [Actions → CI](https://github.com/lude2001/lpc-support/actions/workflows/ci.yml)，进入上述成功的 main 运行记录。
2. 在 **Artifacts** 中下载表格所列的六个 artifact，解压出 `.vsix` 文件。例如 `lpc-support-darwin-arm64-0.52.19.vsix` 是 Apple Silicon Mac 的包。
3. 核对六个文件的平台和版本，全部来自同一次 CI，存入该版本的发布目录。

`lpc-support-vsix` 是 **Build and test** job 上传的当前平台副本，发布时使用表格中的六个平台 artifact 即可。

GitHub artifact 保留 14 天，请及时保存完整六包及来源记录。若已过期，应先重新运行 CI，等六个平台全部成功后再准备发布。

## 3. 在 Marketplace 网页逐个更新

1. 使用现有发布者账号登录 [easyCat（ludexiang）管理页面](https://marketplace.visualstudio.com/manage/publishers/ludexiang)。
2. 找到 **LPC[FluffOS]**（`ludexiang.lpc-support`），打开操作菜单中的 **Update**。
3. 每次选择或拖入一个 `.vsix`，点击 **Upload**，等待这次上传完成。
4. 重复 Update / Upload，上传同版本的其余五个平台包。
5. 等待市场校验完成，确认该版本覆盖表格中的全部六个平台，核对版本和用户可见更新日志。

六个包更新同一个扩展条目。完整发布记录应包含版本、源提交、CI 链接，以及每个平台的上传结果。

## 上传中断或缺少平台

- 记录已经成功的平台，继续用同一次 CI 保存的原始 VSIX 补齐剩余平台。
- 已存在的平台 / 版本若被提示重复，先核对市场记录和原发布文件。
- 发布目录混入其他构建、原始包丢失或来源无法确认时，应准备新版本并重新构建完整六包。

## 本地打包与 CI 维护

`npm run package` 构建当前设备平台的 VSIX。六个平台的交付结果以 CI 各自的原生构建和 smoke 为准。

修改 CI 时可用 `actionlint` 核验 YAML，运行 `npm run test:ci-tools` 检查诊断通知交错、文档版本、超时和释放行为。平台打包继续依赖完整的 **Build and test** 验收。

参考：[VS Code 官方发布指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-an-extension)、[平台专用扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platform-specific-extensions)。
