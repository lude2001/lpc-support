# M6 独立审阅

审阅者：`/root/m1_efun_baseline`。本次仅阅读工作区实现、测试与相对 HEAD 的 diff；未修改生产代码，未运行 Jest、远端模型、FluffOS 或真实 mudlib。

## 实际范围

- `src/localization/documentationLanguage.ts`
- `src/glm4Client.ts`
- `src/codeActions.ts`
- `src/functionDocs/services/FunctionDocumentationAuthoringService.ts`
- `src/localization/__tests__/documentationLanguage.test.ts`
- `src/__tests__/glm4Client.test.ts`
- `src/__tests__/codeActions.test.ts`
- `src/functionDocs/__tests__/FunctionDocumentationAuthoringService.test.ts`

另只读核对了清单中该设置的 `resource` scope，以及函数文档中心 AI 按钮委托 `lpc.generateJavadoc` 的调用关系。

## 结论

未发现可确认的 M6 新增行为错误。以下结论来自实现与测试内容审阅，不代表测试已经执行：

- `resolveDocumentationLanguage` 仅接受 `en` 作为英文输出，其余值均返回 `zh-cn`，包含缺省和非法配置；不读取界面语言。
- AI 命令与确定性文档骨架 / 补全使用同一个 getter，并传入目标 `editor.document.uri`，能够读取文档所属工作区的设置。函数文档中心 AI 入口最终复用同一命令。
- 中英文提示词分别明确新增说明的语言，并要求标识符、类型、路径、宏、Javadoc 标签、代码示例及已有正文保持原文。函数源码直接附在 user prompt 末尾，没有进行字符串翻译或签名改写。
- 生成结果继续经过唯一完整注释、摘要、参数身份 / 重复 / 描述、void / 非 void 返回说明的既有校验；`finish_reason === 'length'` 仍拒绝结果。命令保留已有注释拒绝、模型选择取消后提前返回、生成完成后的文档版本检查和编辑失败处理。
- 确定性生成只改变新增 TODO 文案；补全仍只处理已确认缺失项，已有正文不因输出语言切换而重写。原先重复、过时及孤立标签的显式修复路径没有扩大范围。
- 四套测试包含 UI × 输出语言组合、资源 URI 读取、缺省 / 非法 fallback、原文保留、CRLF / 缩进、参数与返回值契约、截断及文档版本变化等场景。

## 待验收边界

1. Jest 尚待主任务统一执行。`codeActions.test.ts` 当前没有直接覆盖“模型选择器返回 undefined 后，不调用 API 且不插入”的回归用例；实现中的提前返回分支保留，属于测试覆盖缺口，没有观察到取消行为回归。
2. GLM 测试用预设响应核对提示词与返回内容，不能证明远端模型实际遵循输出语言。当前结果校验器验证 Javadoc 结构和签名契约，不做自然语言识别；本轮没有调用真实模型，也不据此要求新增语言检测功能。
### 后续定向回归

根代理随后要求补齐取消模型选择的直接回归。作者已仅新增测试，验证 selectModel 返回 undefined 时不创建模型请求、不调用 generateJavadoc，也不调用 editor.edit/insert；该单套 8 项通过，完整 Jest 终验 40 套/337 项通过。证据为 `.tmp/i18n/jest-m6-cancel.json` 与 `.tmp/i18n/jest-final-local.json`。这是后续执行记录，不表示本报告的独立审阅者执行了测试；生产取消分支未改。
