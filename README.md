# LPC Support 扩展

LPC Support 是一个为 LPC (LPMud Creation) 语言开发而设计的 VSCode 扩展，由武侠黎明团队开发，具备兼容性和通用性的LPC语言的VSCode扩展。

## 注意事项

- 本扩展的语法规范仅适应作者团队的代码风格，请按需使用。
- 未使用变量的检查功能其中的一部分说明,目前不提示在定义变量后，在后续代码块中赋值但是没有被引用的变量。因为fluffos驱动的逻辑仅弹出[变量类型 变量名]定义后后续不进行使用或[变量类型 变量名=值]两种情况未使用的变量。为了兼容fluffos的逻辑，所以此处不提示，后续考虑在0.0.3版本将根据fluffos驱动的弹出的逻辑进行二次调整。

## 功能特色

- **语法高亮**：LPC 语言语法高亮显示。
- **智能补全**：支持 LPC 内置函数（efun）、库函数及自定义函数的智能代码补全。
- **实时诊断**：自动检测语法错误、未使用变量及潜在问题，提升代码质量。
- **宏定义支持**：识别并处理宏定义，提供宏补全及跳转功能。
- **服务器管理**：简单添加、删除及管理 FluffOS 服务器配置，并支持一键编译文件至服务器。
- **代码格式化**：代码格式化，按作者团队代码风格格式化。
- **Efun 文档**：内置 efun 函数文档，支持实时查看和更新。
- **快速修复**：提供代码问题的快速修复建议。

## 安装与依赖

### 环境要求

- Visual Studio Code 版本 1.95.0 或更高
- Node.js 版本 16.x 或更高

### 安装步骤

1. 打开 VSCode 扩展市场，搜索 "LPC Support"。
2. 点击安装，并重启 VSCode 以激活扩展。

## 扩展配置

### 基础配置

在 VSCode 的设置中（文件 > 首选项 > 设置），可以配置以下选项：

1. **宏定义目录配置**
   - 配置项：`lpc.includePath`
   - 说明：设置宏定义文件所在的目录路径，或者通过编辑器窗口选择目录。
   - 示例：`/path/to/include`
   - 配置方式：
     ```json
     {
       "lpc.includePath": [
         "/mud/include",
         "/mud/include/feature",
         "${workspaceFolder}/include"
       ]
     }
     ```

2. **模拟函数库配置**
   - 配置项：`lpc.simulatedEfunsPath`
   - 说明：设置模拟函数库目录的路径【通过javadoc解析模拟函数库用于代码提示，详细请看模拟函数库内函数文档注释规范】
   - 示例：`/path/to/simul_efun`

### 服务器配置

可以通过以下步骤配置 FluffOS 服务器：

1. 使用命令面板（Ctrl+Shift+P）输入 "LPC: 管理服务器"
2. 点击 "添加服务器" 并填写以下信息：
   - 服务器名称
   - 服务器URL（例如：http://127.0.0.1:8080）
   - 服务器描述（可选）

### 格式化配置

代码格式化遵循以下规则：
- 缩进大小：4个空格
- 最大行长度：80个字符
- 括号间距：保持空格
- 使用双引号
- 语句结尾使用分号
- 大括号前换行

## 使用指南

### 代码补全

扩展提供全面的代码补全功能：

1. **Efun 函数补全**
   - 自动显示函数签名
   - 实时显示函数文档
   - 参数提示

2. **宏定义补全**
   - 自动扫描宏定义文件
   - 显示宏定义值和注释
   - 支持跳转到定义

3. **自定义函数补全**
   - 项目内函数自动补全
   - 函数参数提示
   - 返回值类型提示

### 代码诊断

实时检测以下问题：

1. **语法错误**
   - 括号匹配
   - 语法规范检查
   - 类型检查

2. **变量检查**
   - 未使用变量提示
   - 未初始化变量检查
   - 重复定义检查

3. **函数检查**
   - 参数数量检查
   - 返回值类型检查
   - 未使用函数检查

### 服务器操作

1. **编译文件**
   - 快捷键：`Ctrl+F5`
   - 右键菜单：LPC > 编译文件
   - 支持文件夹批量编译

2. **服务器管理**
   - 添加/删除服务器
   - 修改服务器配置
   - 切换活动服务器

### Efun 文档

1. **查看文档**
   - 悬停显示函数文档
   - 支持中文文档
   - 实时更新

2. **文档更新**
   - 手动更新文档
   - 自动同步最新文档
   - 离线文档支持，自动缓存文档

## 快捷键

- `Ctrl+/`: 行注释
- `Shift+Alt+A`: 块注释
- `Ctrl+F5`: 编译当前文件
- `F12`: 跳转到定义
- `Alt+F12`: 查看定义

## 常见问题

1. **宏定义不生效**
   - 检查宏定义目录配置是否正确
   - 确认宏文件格式是否正确
   - 重新扫描宏定义（命令：LPC: 扫描宏定义）

2. **编译失败**
   - 检查服务器配置是否正确
   - 确认服务器是否在线
   - 查看错误日志获取详细信息

3. **代码补全不工作**
   - 确认文件扩展名是否正确（.c/.h/.lpc）
   - 检查语言服务是否正常启动
   - 尝试重新加载窗口

## 更多资源

- [LPC 函数文档](https://mud.wiki/LPC) 本扩展从mud.wiki获取LPC函数文档并更新
- [FluffOS 文档](https://www.fluffos.info) 本扩展从fluffos.info获取FluffOS文档并更新
- [项目 GitHub](https://github.com/yourusername/lpc-support)

## 版本更新

### 0.0.1

- 实现基本功能：语法高亮、代码补全、诊断及服务器管理
- 初步支持宏定义功能
- 添加 Efun 文档支持
- 实现代码快速修复功能

## 模拟函数库内函数文档注释规范

为了更好地支持代码提示和文档生成，请按照以下 JavaDoc 格式编写函数注释：

```c
/**
 * @brief 创建一个299类型的消息(用于特殊提示)
 * @param string title 消息标题
 * @param string msg 消息内容
 * @return string JSON格式的消息字符串
 */
string msg299(string title,string msg)
{
    mapping jsonData = ([]);

    jsonData["code"] = 299;
    jsonData["title"] = title;
    jsonData["msg"] = replace_string(msg, "\n",ZJBR);

    return json_encode(jsonData) + "\n";
}
```

注释格式说明：
1. 使用 `/**` 开始，`*/` 结束的多行注释
2. `@brief` 标签：简短描述函数的功能
3. `@param` 标签：描述函数参数
   - 格式：`@param 类型 参数名 参数描述`
   - 每个参数单独一行
4. `@return` 标签：描述返回值
   - 格式：`@return 返回类型 返回值描述`

编写规范的函数文档注释可以获得以下好处：
- 在使用函数时获得完整的代码提示
- 鼠标悬停时显示详细的函数文档
- 支持函数参数提示
- 便于生成API文档

## 服务器接口实现示例

为了支持远程编译功能，LPMud 服务器需要实现以下 HTTP 接口。以下是一个基本的实现示例：

```c
#define RequestType(f_name,http_type) string f_name = http_type;

inherit "/adm/special_ob/http/base.c";

string url_decode(string str)
{
    str = replace_string(str, "%2F", "/");
    str = replace_string(str, "%20", " ");
    str = replace_string(str, "%3A", ":");
    str = replace_string(str, "%2E", ".");
    // 添加其他需要解码的字符
    return str;
}

RequestType(update_file,"POST")
mapping update_file(string file_name)
{   
    mapping result = ([]);
    string msg;

    if (!file_name)
    {
        result["code"] = "update_file";
        result["file_name"] = "空文件";
        result["msg"] = "没有指定文件！";
        return result;
    }

    // 对文件名进行URL解码
    file_name = url_decode(file_name);

    result["code"] = "update_file";
    result["file_name"] = file_name;
    msg = call_other("/cmds/wiz/update", "compile_file", file_name);
    result["msg"] = msg;

    return result;
}
```

接口说明：
1. **接口定义**
   - 使用 `RequestType` 宏定义 HTTP 请求类型
   - 示例中定义了 `update_file` 为 POST 请求

2. **URL 解码**
   - 实现 `url_decode` 函数处理文件路径中的特殊字符
   - 支持常见的 URL 编码字符转换

3. **编译接口**
   - 接口名：`update_file`
   - 请求方式：POST
   - 参数：`file_name`（文件路径）
   - 返回格式：JSON
     ```json
     {
       "code": "update_file",
       "file_name": "文件路径",
       "msg": "编译结果信息"
     }
     ```

4. **错误处理**
   - 文件名为空时返回错误信息
   - 编译失败时返回错误详情，并弹出错误信息到编辑器上下文进行定位，并通过问题栏输出。

5. **使用方法**
   - 在服务器配置中设置正确的 URL
   - VSCode 扩展会自动调用此接口进行远程编译

注意：实际部署时请根据您的服务器环境和安全需求进行适当调整。

