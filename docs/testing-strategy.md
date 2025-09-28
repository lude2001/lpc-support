# LPC语法测试策略

## 测试概述

本文档详细说明了LPC插件新语法特性的测试策略、测试用例设计说明以及回归测试计划。

## 测试架构

### 测试层次结构

```
测试架构
├── 单元测试 (Unit Tests)
│   ├── 词法分析器测试
│   ├── 语法分析器测试
│   └── 语义分析器测试
├── 集成测试 (Integration Tests)
│   ├── 端到端解析测试
│   ├── 错误处理测试
│   └── 性能基准测试
└── 回归测试 (Regression Tests)
    ├── 现有功能保护
    ├── 边界条件测试
    └── 兼容性验证
```

## 新语法特性测试策略

### 1. 二进制字面量测试

#### 测试目标
- 验证正确的二进制字面量识别
- 确保错误格式的正确处理
- 测试边界值和特殊情况

#### 测试用例设计

```typescript
describe('Binary Literal Tests', () => {
  test('Valid binary literals', () => {
    expect(parseLiteral('0b1010')).toEqual(10);
    expect(parseLiteral('0B1111')).toEqual(15);
    expect(parseLiteral('0b1010_1111')).toEqual(175);
    expect(parseLiteral('0b0')).toEqual(0);
    expect(parseLiteral('0b1')).toEqual(1);
  });

  test('Invalid binary literals', () => {
    expect(() => parseLiteral('0b')).toThrow();
    expect(() => parseLiteral('0b2')).toThrow();
    expect(() => parseLiteral('0bG')).toThrow();
    expect(() => parseLiteral('0b_1010')).toThrow();
  });

  test('Binary literal edge cases', () => {
    expect(parseLiteral('0b' + '1'.repeat(31))).toBeDefined(); // Max 31-bit
    expect(parseLiteral('0b1010_1111_0000_0001')).toBeDefined(); // With separators
  });
});
```

#### 测试文件示例
```lpc
// test-files/binary-literals.lpc
int test_binary_literals() {
    int a = 0b1010;        // 正常二进制
    int b = 0B1111;        // 大写前缀
    int c = 0b1010_1111;   // 带分隔符
    int d = 0b0;           // 零值
    int e = 0b1;           // 单位值
    return a + b + c + d + e;
}
```

### 2. 右索引运算符测试

#### 测试目标
- 验证右索引语法的正确解析
- 测试与传统索引的兼容性
- 验证范围操作的正确性

#### 测试用例设计

```typescript
describe('Right Index Operator Tests', () => {
  test('Basic right indexing', () => {
    expect(parseExpression('array[<1]')).toMatchAST({
      type: 'SliceExpression',
      operator: 'tailIndex',
      index: 1
    });
  });

  test('Right index ranges', () => {
    expect(parseExpression('array[<5..<2]')).toMatchAST({
      type: 'SliceExpression',
      operator: 'tailRange',
      start: 5,
      end: 2
    });
  });

  test('Mixed index ranges', () => {
    expect(parseExpression('array[2..<1]')).toMatchAST({
      type: 'SliceExpression',
      operator: 'mixedRange',
      start: 2,
      endFromRight: 1
    });
  });
});
```

#### 测试文件示例
```lpc
// test-files/right-indexing.lpc
mixed test_right_indexing() {
    string* arr = ({ "a", "b", "c", "d", "e" });

    mixed result = ({
        arr[<1],        // 最后一个元素
        arr[<2],        // 倒数第二个
        arr[<3..<1],    // 右索引范围
        arr[1..<2],     // 混合范围
        arr[<5..],      // 开放右索引
    });

    return result;
}
```

### 3. Switch范围匹配测试

#### 测试目标
- 验证所有范围语法变体
- 测试边界条件处理
- 确保与现有case语法兼容

#### 测试用例设计

```typescript
describe('Switch Range Matching Tests', () => {
  test('Complete range syntax', () => {
    const switchStmt = `
      switch(value) {
        case 1..5: break;     // 完整范围
        case ..10: break;     // 开放起始
        case 20..: break;     // 开放结束
        case 42: break;       // 单值
      }
    `;
    expect(parseStatement(switchStmt)).toMatchAST({
      type: 'SwitchStatement',
      cases: [
        { type: 'range', start: 1, end: 5 },
        { type: 'openStart', end: 10 },
        { type: 'openEnd', start: 20 },
        { type: 'single', value: 42 }
      ]
    });
  });
});
```

#### 测试文件示例
```lpc
// test-files/switch-ranges.lpc
string test_switch_ranges(int value) {
    switch(value) {
        case 1..5:
            return "small";
        case ..0:
            return "negative or zero";
        case 10..:
            return "large";
        case 6..9:
            return "medium";
        default:
            return "unknown";
    }
}
```

## 回归测试计划

### 1. 现有功能保护测试

#### 核心语法回归套件
```typescript
describe('Core Syntax Regression Tests', () => {
  test('Basic variable declarations', () => {
    expect(parseCode('int x = 5;')).toMatchSnapshot();
    expect(parseCode('string* names = ({ "a", "b" });')).toMatchSnapshot();
  });

  test('Function definitions', () => {
    expect(parseCode('int add(int a, int b) { return a + b; }')).toMatchSnapshot();
  });

  test('Control flow statements', () => {
    expect(parseCode('if (x > 0) y = 1; else y = 0;')).toMatchSnapshot();
    expect(parseCode('for (int i = 0; i < 10; i++) sum += i;')).toMatchSnapshot();
  });
});
```

#### 复杂表达式回归测试
```lpc
// test-files/regression/complex-expressions.lpc
mixed test_complex_expressions() {
    // 深度嵌套表达式
    int result = ((a + b) * (c - d)) / ((e % f) + (g << h));

    // 函数调用链
    object obj = find_player("test")->query_current_attacker()->environment();

    // 复杂数组操作
    mixed data = ({
        ([ "key1": ({ 1, 2, 3 }) ]),
        func1(arg1, arg2)->query_property("test"),
        sprintf("%s: %d", name, value)
    });

    return data;
}
```

### 2. 边界条件测试

#### 极限值测试
```typescript
describe('Boundary Condition Tests', () => {
  test('Maximum nesting levels', () => {
    const deepNesting = '((('.repeat(100) + 'x' + ')))'.repeat(100);
    expect(() => parseExpression(deepNesting)).not.toThrow();
  });

  test('Large binary literals', () => {
    expect(parseLiteral('0b' + '1'.repeat(31))).toBeDefined();
  });

  test('Complex array slicing', () => {
    expect(parseExpression('array[<100..<1][0..5][<3]')).toBeDefined();
  });
});
```

#### 错误恢复测试
```lpc
// test-files/error-recovery.lpc
// 这个文件包含各种语法错误，测试解析器的错误恢复能力

int test_error_recovery() {
    // 缺少分号 - 应该能够恢复
    int x = 5
    int y = 10;  // 这行应该仍然能正确解析

    // 不完整的表达式
    if (x >  {   // 错误：不完整的条件
        y = 1;   // 这里应该能恢复
    }

    return y;
}
```

### 3. 性能基准测试

#### 解析性能测试
```typescript
describe('Performance Benchmark Tests', () => {
  test('Large file parsing performance', () => {
    const startTime = Date.now();
    const ast = parseFile('test-files/large-file.lpc'); // 10MB+ 文件
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
    expect(ast).toBeDefined();
  });

  test('Memory usage during parsing', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    parseFile('test-files/complex-grammar.lpc');
    const finalMemory = process.memoryUsage().heapUsed;

    expect(finalMemory - initialMemory).toBeLessThan(100 * 1024 * 1024); // 100MB限制
  });
});
```

## 测试数据管理

### 测试文件组织结构
```
test-files/
├── unit/
│   ├── binary-literals.lpc
│   ├── right-indexing.lpc
│   └── switch-ranges.lpc
├── integration/
│   ├── complex-scenarios.lpc
│   ├── real-world-examples.lpc
│   └── error-cases.lpc
├── regression/
│   ├── existing-features.lpc
│   ├── boundary-conditions.lpc
│   └── performance-tests.lpc
└── fixtures/
    ├── snapshots/
    └── expected-outputs/
```

### 测试数据生成工具

```typescript
// tools/generate-test-data.ts
class TestDataGenerator {
  generateBinaryLiterals(): string[] {
    const patterns = [];

    // 生成各种长度的二进制字面量
    for (let i = 1; i <= 31; i++) {
      patterns.push('0b' + '1'.repeat(i));
      patterns.push('0B' + '0'.repeat(i));
    }

    // 生成带分隔符的变体
    patterns.push('0b1010_1111');
    patterns.push('0b1111_0000_1111_0000');

    return patterns;
  }

  generateRightIndexExpressions(): string[] {
    return [
      'array[<1]',
      'array[<5..<1]',
      'array[2..<3]',
      'array[<10..]',
      'array[..<5]'
    ];
  }
}
```

## 持续集成配置

### CI/CD管道配置
```yaml
# .github/workflows/test.yml
name: LPC Grammar Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Generate ANTLR parser
      run: npm run generate-parser

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Run regression tests
      run: npm run test:regression

    - name: Performance benchmarks
      run: npm run test:performance

    - name: Generate coverage report
      run: npm run test:coverage
```

## 测试质量标准

### 覆盖率要求
- 代码覆盖率：≥90%
- 分支覆盖率：≥85%
- 函数覆盖率：≥95%
- 行覆盖率：≥90%

### 性能基准
- 小文件解析（<1KB）：<10ms
- 中等文件解析（1-100KB）：<100ms
- 大文件解析（100KB-1MB）：<1s
- 超大文件解析（1-10MB）：<10s

### 质量门禁
- 所有单元测试必须通过
- 回归测试通过率≥99%
- 新增特性测试覆盖率100%
- 性能不能比基线降低超过10%

---

## 测试工具和框架

### 使用的测试工具
- **Jest**: 主要测试框架
- **ANTLR4**: 语法解析器
- **TypeScript**: 类型安全的测试代码
- **Snapshot Testing**: 语法树结构验证

### 自定义匹配器
```typescript
// jest.setup.ts
expect.extend({
  toMatchAST(received, expected) {
    const pass = deepEqual(normalizeAST(received), expected);
    return {
      pass,
      message: () => `Expected AST to match structure`
    };
  }
});
```

---

*最后更新：2024年9月27日*
*负责人：开发团队*