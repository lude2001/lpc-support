# LPC 宏定义调试指南

## 🔍 问题描述

如果你遇到以下问题：
- 定义跳转能找到宏（如 `COMBAT_D`），但诊断系统报告"未定义为宏"
- 宏悬停显示正确，但警告仍然存在
- 某些宏能被识别，某些不能

这通常是 **MacroManager 配置或扫描问题**。

## 🛠️ 快速诊断步骤

### 1. 运行宏调试命令
1. 在 LPC 文件中右键
2. 选择 **"LPC: 调试宏管理器"**
3. 查看输出窗口的调试信息

### 2. 检查调试输出

调试命令会显示：
- **配置的包含路径**：MacroManager 扫描的目录
- **扫描到的宏数量**：找到的宏定义总数
- **宏列表**：所有已扫描的宏及其文件位置
- **特定宏测试**：测试 `COMBAT_D` 宏是否被找到

## 🔧 常见问题和解决方案

### 问题1：包含路径未配置
**症状**：调试输出显示 "配置的包含路径: 未配置"

**解决方案**：
1. 打开 VS Code 设置 (Ctrl+,)
2. 搜索 `lpc.includePath`
3. 设置为包含宏定义的目录路径
4. 例如：`/path/to/your/mudlib/include`

### 问题2：包含路径不存在
**症状**：调试输出显示 "包含路径不存在"

**解决方案**：
1. 检查路径是否正确
2. 确保路径存在且可访问
3. 使用绝对路径或相对于工作区的路径

### 问题3：找不到目标文件
**症状**：扫描到的宏列表中没有 `COMBAT_D`

**解决方案**：
1. 确认 `globals.h` 文件在包含路径下
2. 检查文件扩展名是否为 `.h`
3. 检查宏定义格式是否正确：
   ```c
   #define COMBAT_D /adm/daemons/combatd
   ```

### 问题4：宏定义格式问题
**症状**：文件存在但宏未被识别

**检查宏定义格式**：
- ✅ 正确：`#define COMBAT_D /adm/daemons/combatd`
- ✅ 正确：`#define MAX_LEVEL 100`
- ❌ 错误：`#define combat_d /adm/daemons/combatd` (小写)
- ❌ 错误：`define COMBAT_D xxx` (缺少 #)

MacroManager 只识别：
- 以 `#define` 开头
- 宏名由大写字母、数字和下划线组成
- 符合正则表达式：`/^#define\s+([A-Z_][A-Z0-9_]*)\s+(.+)$/`

## 🔍 详细调试步骤

### 步骤1：检查控制台日志
1. 打开 VS Code 开发者工具 (F12)
2. 查看 Console 标签
3. 查找 MacroManager 相关日志：
   ```
   MacroManager: 配置的包含路径: /path/to/include
   MacroManager: 包含路径存在，开始扫描宏定义
   MacroManager: 在 /path/to/include/globals.h 中找到 5 个宏定义
   MacroManager: 扫描完成，共找到 25 个宏定义，耗时 15ms
   ```

### 步骤2：验证文件结构
确认你的项目结构类似于：
```
your-mudlib/
├── include/
│   ├── globals.h      ← 包含 COMBAT_D 定义
│   ├── lib.h
│   └── std.h
├── adm/
└── std/
```

### 步骤3：测试配置更改
1. 运行命令：**"LPC: 配置宏定义目录"**
2. 输入正确的包含路径
3. 等待扫描完成
4. 重新运行调试命令验证

## ⚙️ 配置示例

### 工作区设置 (.vscode/settings.json)
```json
{
    "lpc.includePath": "./include",
    "lpc.performance.debounceDelay": 300
}
```

### 用户设置
```json
{
    "lpc.includePath": "/home/user/mudlib/include"
}
```

## 🚀 高级故障排除

### 强制重新扫描
1. 运行 **"LPC: 清理解析缓存"**
2. 重新打开 LPC 文件
3. 或重启 VS Code

### 手动验证宏定义
在 `globals.h` 中找到：
```c
#define COMBAT_D /adm/daemons/combatd
```

确保：
- 行首是 `#define`
- `COMBAT_D` 全大写
- 后面有空格分隔值
- 没有语法错误

### 检查文件权限
确保 VS Code 有读取包含目录和文件的权限。

## 📊 预期结果

修复后，你应该看到：
- 调试命令显示找到了 `COMBAT_D` 宏
- 不再出现"未定义为宏"警告
- 悬停显示正确的宏定义
- 定义跳转正常工作

## 🆘 仍然有问题？

如果按照上述步骤仍然无法解决：

1. **收集信息**：
   - 运行宏调试命令的完整输出
   - VS Code 控制台的 MacroManager 日志
   - 你的项目目录结构
   - `globals.h` 文件中 `COMBAT_D` 的定义

2. **临时解决方案**：
   - 在设置中禁用相关诊断检查
   - 或调整诊断规则的正则表达式

这个问题通常是配置问题，按照指南操作应该能够解决。 