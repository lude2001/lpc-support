# 开发贡献指南

## 项目架构

### 核心模块

```
src/
├── diagnostics/          # 诊断系统（协调器模式）
│   ├── DiagnosticsOrchestrator.ts  # 主协调器
│   ├── collectors/       # 诊断收集器
│   └── analyzers/        # 变量分析器
├── extension.ts          # 扩展入口
└── parser/              # ANTLR4 语法解析器
```

### 诊断系统

使用协调器模式，支持模块化的诊断收集器：

```typescript
// 创建自定义收集器
export class MyCollector implements IDiagnosticCollector {
    readonly name = 'MyCollector';

    collect(document: TextDocument, parsed: ParsedDoc): Diagnostic[] {
        const diagnostics = [];
        // 实现检查逻辑
        return diagnostics;
    }
}

// 在 DiagnosticsOrchestrator.initializeCollectors() 中注册
```

## 快速开始

### 开发环境设置

```bash
# 安装依赖
npm install

# 编译项目
npm run compile

# 运行测试
npm test

# 调试扩展
按 F5 启动调试
```

### 添加新功能

1. **创建收集器类** - 实现 `IDiagnosticCollector` 接口
2. **注册收集器** - 在协调器中添加
3. **编写测试** - 确保功能正确
4. **更新文档** - 更新 CHANGELOG.md

## 性能优化

- 使用缓存避免重复解析
- 防抖处理高频事件
- 异步执行耗时操作
- 批量处理诊断收集

配置示例：
```json
{
  "lpc.performance.debounceDelay": 300,
  "lpc.performance.batchSize": 50,
  "lpc.performance.enableAsyncDiagnostics": true
}
```

## 测试指南

```typescript
// 单元测试示例
describe('MyCollector', () => {
    it('应该检测问题', () => {
        const collector = new MyCollector();
        const diagnostics = collector.collect(mockDoc, mockParsed);
        expect(diagnostics).toHaveLength(1);
    });
});
```

## 代码规范

- 使用 TypeScript 类型系统
- 遵循单一职责原则
- 添加清晰的注释
- 编写单元测试

## 提交流程

1. Fork 项目
2. 创建特性分支
3. 提交更改（遵循 Conventional Commits）
4. 推送到分支
5. 创建 Pull Request

## 资源链接

- [VS Code Extension API](https://code.visualstudio.com/api)
- [ANTLR4 TypeScript](https://github.com/tunnelvisionlabs/antlr4ts)
- [项目 README](../README.md)
