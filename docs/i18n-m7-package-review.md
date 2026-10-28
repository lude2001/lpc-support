# M7 打包门禁定向独立复核

审阅者：`/root/m1_efun_baseline`。

本次静态阅读 `scripts/localization/check-vsix-localization.mjs`、其对应 Node 测试，以及复用的 `check-efun-localization.mjs` 门禁。仅确认下面三条原问题的修复；未改冻结脚本或产品，未重跑测试、打包、安装或执行任何原生二进制。

## 1. 打包契约必须经过完整独立复核门禁 — resolved

`loadReviewedContract()` 在读取作者 ledger 并建立打包 hash 契约之前，先 `await checkEfunLocalization(root)`。后者核验结构基线、原文快照来源、两语言目录和字段、作者记录、当前译文 hash，以及独立 reviewer 的身份、组号、字段覆盖和 hash；历史 issues 必须逐条 resolved 并带有 resolution reference/detail。只更新作者 hash 无法绕过独立复核。

实际 CLI 没有注入替代契约的参数；`checkVsixLocalization()` 的生产默认值调用上述加载入口。测试中的小型合成契约仍明确属于测试接口。已阅读回归用例：只更新英文译文及作者 hash、保留旧独立记录时，`loadReviewedContract()` 必须拒绝。

## 2. 不能只凭 magic 和架构接受非目标可执行文件 — resolved

`nativeTarget()` 先检查读取所需的头部长度与表边界，再判定目标：

- PE：验证 DOS/PE 偏移、PE32+ optional header、section table 覆盖范围与支持的 machine；要求 executable image 位并拒绝 DLL 位。
- ELF：要求完整 ELF64 little-endian header、正确版本和 header 大小，ABI 仅接受 SYSV/Linux；仅接受 EXEC/DYN，拒绝可重定位对象。入口非零，program-header 项大小、数量和表范围必须有效；检查 PT_LOAD 的文件/内存长度及文件边界，入口必须落在带执行标志的 load segment 中。
- Mach-O：要求完整 64 位 header、MH_EXECUTE 类型、有效且位于文件范围内的 load-command 区域，以及支持的 CPU 类型；dylib 等其他文件类型不再被当作 sidecar。

已阅读对应的 DLL、非 executable PE、PE32、截断 PE、可重定位 ELF、FreeBSD ABI、空入口、越界 program headers、无可执行 load segment、Mach-O dylib 和截断 load-command 区域的拒绝用例。它们更新 checksum 后仍须被拒绝，说明不是仅靠 SHA-256 触发拒绝。

这些静态检查确认文件类型、架构和所检查的头部/表/入口条件；不证明操作系统加载器能够执行任意合成文件，也不替代六个平台真实 sidecar 的 CI 运行结果。

## 3. 保留 ZIP 中的 Unix mode 并核验执行位 — resolved

`readArchive()` 为每个普通文件保留 `externalFileAttributes` 高 16 位的 mode，并将 `modes` 与内容一起交给 `checkNative()`。Linux/macOS sidecar 必须至少带一个 `0o111` 执行位；缺失 mode 同样无法通过该条件。Windows sidecar 不套用 Unix 权限规则。

已阅读 Linux/macOS 的 `0o100644` 拒绝用例，以及 Windows 不要求 Unix 执行位的用例。检查针对档案内的权限，不依赖解压后的宿主系统权限。

三条定向问题均已关闭；没有将本次静态阅读记作测试执行或跨平台原生验收。
