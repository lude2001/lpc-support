"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.efunDocumentations = void 0;
exports.efunDocumentations = {
    'allocate': `# allocate
    
**语法:** array allocate(int size)

**说明:** 创建一个指定大小的数组,数组元素初始化为 0。

**参数:**
- size: 数组大小

**返回值:** 返回创建的数组

**示例:**
\`\`\`c
int *arr = allocate(5);  // 创建大小为5的整型数组
\`\`\`

**参考:** https://mud.wiki/Lpc:Efun:allocate`,
    'arrayp': `# arrayp

**语法:** int arrayp(mixed arg) 

**说明:** 检查变量是否为数组。

**参数:**
- arg: 要检查的变量

**返回值:** 如果参数是数组返回 1,否则返回 0

**示例:**
\`\`\`c
int *arr = ({1, 2, 3});
if(arrayp(arr)) write("这是一个数组\\n");
\`\`\`

**参考:** https://mud.wiki/Lpc:Efun:arrayp`,
    // ... 其他 efun 文档
};
//# sourceMappingURL=efunDocs.js.map