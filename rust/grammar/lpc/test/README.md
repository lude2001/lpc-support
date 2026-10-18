# 语法回归样例

`coverage.json` 是独立构造的合法语法样例，没有包含真实 MUDLib 源码。每项的 `driverRule` 记录对应的驱动规则。

2026-10-18 对照的 FluffOS 源码基线为 `b51f5ff7a1e49f94b5f83ba4cee28f32f1881e37`，主要依据 `src/compiler/internal/grammar.y`、`lexer.l`、`lexer_utils.cc` 和相关语义规则。受 `ARRAY_RESERVED_WORD` 或 `DEBUG` 控制的语法也保留为兼容样例。

- grammar Rust 测试逐项断言可以解析。
- formatter Rust 测试逐项断言格式化前后 CST 一致、结果可解析且再次格式化不变；容易丢失的类型名、闭包和字面量另有明确预期。
- 非法上下文、宏分支和语言事实在对应 crate 的测试中验证；实际 stdio 链路由 `scripts/syntax-coverage-smoke.mjs` 覆盖。

在仓库根目录运行 `npm run test:rust` 和 `npm run test:rust-smoke`。这些样例是回归保护，不代表驱动运行时或完整语言覆盖率。
