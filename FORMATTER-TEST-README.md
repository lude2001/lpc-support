# LPC格式化独立测试程序

这是一个独立的LPC格式化测试程序，可以在命令行环境中运行，不依赖VS Code IDE。

## 🚀 快速开始

### 环境要求

- Node.js (版本 14 或更高)
- TypeScript (`npm install -g typescript`)
- ts-node (`npm install -g ts-node`)

### 安装依赖

```bash
npm install
```

### 运行方式

#### 1. 使用脚本启动器（推荐）

**Windows:**
```cmd
run-formatter-test.bat
```

**Linux/macOS:**
```bash
chmod +x run-formatter-test.sh
./run-formatter-test.sh
```

#### 2. 直接使用命令行

```bash
# 运行内置测试用例
npx ts-node standalone-formatter.ts --builtin

# 运行全部测试
npx ts-node standalone-formatter.ts --all

# 测试单个文件
npx ts-node standalone-formatter.ts --file path/to/your/file.lpc

# 测试整个目录
npx ts-node standalone-formatter.ts --dir path/to/directory

# 显示帮助信息
npx ts-node standalone-formatter.ts --help
```

#### 3. 使用npm脚本

```bash
# 运行内置测试
npm run test-formatter:builtin

# 运行全部测试
npm run test-formatter:all

# 测试指定目录（需要传递参数）
npm run test-formatter:dir test-files
```

## 📋 测试内容

### 内置测试用例

程序包含以下内置测试用例，涵盖LPC语言的各种语法特性：

1. **基础语法**
   - 变量声明格式化
   - 函数定义格式化
   - 控制结构格式化

2. **LPC特有语法**
   - 数组字面量: `({"item1", "item2"})`
   - 映射字面量: `(["key":"value"])`
   - 函数指针: `(:function_name:)`
   - 表达式函数指针: `(:$1+$2:)`

3. **高级语法**
   - foreach循环及ref语法
   - switch范围匹配: `case 1..5:`
   - 匿名函数
   - 继承语句: `inherit "/path/to/file";`

4. **错误处理**
   - 语法错误代码的处理
   - 空文件处理
   - 超长代码处理

### 文件测试

程序会自动查找并测试以下文件：

- `test-files/` 目录中的所有 `.c`, `.h`, `.lpc`, `.i` 文件
- 项目根目录中的测试文件
- 用户指定的任何LPC文件

## 📊 测试报告

测试完成后，程序会生成详细的测试报告，包括：

### 总体统计
- 测试文件总数
- 成功/失败数量
- 成功率
- 总耗时和平均耗时
- 整体状态

### 性能分析
- 最快/最慢/中位数耗时
- 性能分布统计

### 格式化效果
- 成功格式化的文件数量
- 平均大小变化
- 格式化前后的示例对比

### 失败详情
- 失败文件列表
- 详细错误信息
- 故障排除建议

## 📁 示例输出

```
==========================================
               📊 LPC 格式化测试报告
==========================================

📈 总体统计:
   测试文件总数: 15
   成功数量: 14
   失败数量: 1
   成功率: 93.3%
   总耗时: 2543ms
   平均耗时: 169.5ms
   整体状态: ❌ 存在失败

⚡ 性能分析:
   最快耗时: 45ms
   最慢耗时: 892ms
   中位数耗时: 124ms

📝 格式化效果:
   成功格式化文件: 14
   平均大小变化: +127.3 字符

🔍 格式化示例:
   1. test-formatting.c
      格式化前: int x=5,y=10;string name="test";
      格式化后: int x = 5, y = 10;string name = "test";
```

## 🛠️ 高级使用

### 自定义配置

您可以修改 `standalone-formatter.ts` 中的配置，自定义格式化规则：

```typescript
const customConfig: Partial<FormattingConfig> = {
    indentSize: 2,           // 缩进大小
    useSpaces: true,         // 使用空格而非制表符
    spaceAroundOperators: true,  // 操作符周围空格
    maxLineLength: 100,      // 最大行长度
    // ... 其他配置
};

const tester = new StandaloneFormatterTester(customConfig);
```

### 添加自定义测试用例

在 `getBuiltinTestCases()` 方法中添加您的测试用例：

```typescript
{
    name: "我的测试用例",
    description: "测试特定的LPC语法",
    code: `你的LPC代码`
}
```

### 批量测试特定文件类型

程序默认测试 `.c`, `.h`, `.lpc`, `.i` 文件。您可以修改 `findLPCFiles()` 方法来支持其他文件扩展名。

## 🐛 故障排除

### 常见问题

1. **"未找到 ts-node" 错误**
   ```bash
   npm install -g ts-node typescript
   ```

2. **"解析错误" 或格式化失败**
   - 检查LPC文件的语法是否正确
   - 查看错误详情中的具体信息
   - 某些复杂语法可能需要语法解析器的进一步完善

3. **性能问题**
   - 大文件可能需要较长时间
   - 可以调整 `maxFormatTime` 配置项
   - 考虑分批处理大量文件

4. **权限问题（Linux/macOS）**
   ```bash
   chmod +x run-formatter-test.sh
   ```

### 调试模式

如需更详细的调试信息，可以修改代码中的日志级别，或添加额外的控制台输出。

## 🤝 贡献

如果您发现问题或有改进建议，请：

1. 检查现有的测试用例是否覆盖了您的场景
2. 添加新的测试用例来重现问题
3. 提交详细的错误报告，包括：
   - 输入的LPC代码
   - 期望的输出
   - 实际的输出
   - 错误信息

## 📄 许可证

本项目遵循与主项目相同的MIT许可证。