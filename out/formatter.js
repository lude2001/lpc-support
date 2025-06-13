"use strict";
// fs and path would be needed for actual file reading in a Node.js environment
// import * as fs from 'fs';
// import * as path from 'path';
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLPCCode = formatLPCCode;
const defaultConfig = {
    indentSize: 4,
    maxLineLength: 80,
};
// configContent is an optional parameter primarily for environments where direct file reading
// from within this module is not feasible (like this sandboxed agent environment or unit tests).
// In a standard Node.js environment, this function would attempt to read 'formatter-config.json' directly using fs.
function loadFormatterConfig(configContent) {
    try {
        let fileJsonContent;
        if (configContent) {
            fileJsonContent = configContent;
        }
        else {
            // Placeholder for actual file reading logic in a Node.js/VS Code extension environment
            // e.g., const configFilePath = path.resolve(process.cwd(), 'formatter-config.json');
            // fileJsonContent = fs.readFileSync(configFilePath, 'utf8');
            // Since fs is not available directly here in this sandboxed execution,
            // attempting to read would fail. We simulate this by throwing an error if no content is provided,
            // which leads to the use of the default configuration as per requirements.
            throw new Error("File system access for 'formatter-config.json' not available or configContent not provided.");
        }
        const parsedConfig = JSON.parse(fileJsonContent);
        // Validate and merge with defaults to ensure type safety and fallback for missing properties
        const indentSize = typeof parsedConfig.indentSize === 'number' && parsedConfig.indentSize > 0
            ? parsedConfig.indentSize
            : defaultConfig.indentSize;
        const maxLineLength = typeof parsedConfig.maxLineLength === 'number' && parsedConfig.maxLineLength > 0
            ? parsedConfig.maxLineLength
            : defaultConfig.maxLineLength;
        return {
            indentSize,
            maxLineLength,
            // ...assign other validated config properties here
        };
    }
    catch (error) {
        // Catches errors from file reading (simulated by throw) or JSON.parse
        // console.warn(`[formatter.ts] Failed to load or parse formatter configuration: ${error.message}. Using default settings.`);
        return { ...defaultConfig }; // Fallback to default config
    }
}
// The contentOfFormatterConfig parameter allows the caller (e.g., the extension's main file or a test runner)
// to provide the content of 'formatter-config.json'. If not provided, loadFormatterConfig attempts to load it,
// which in this sandboxed environment will result in defaults being used.
function formatLPCCode(code, contentOfFormatterConfig) {
    const config = loadFormatterConfig(contentOfFormatterConfig);
    const indentSize = config.indentSize; // Use this for indentation
    const maxLineLength = config.maxLineLength; // Available, though not used for line breaking in this subtask
    code = code.replace(/\t/g, " ".repeat(indentSize)); // Replace tabs with configured indentSize spaces
    const lines = code.split(/\r?\n/);
    const result = [];
    let indentLevel = 0;
    // const indentSize = 4; // Removed, now using config.indentSize
    const state = {
        // maxLineLength can be added to state if other parts of the formatter need it:
        // maxLineLength: maxLineLength, 
        inBlockComment: false,
        inSpecialBlock: false,
        inString: false,
        inChar: false,
        inFunctionDeclaration: false,
        inFunctionParams: false,
        inSwitchBlock: false,
        inCaseBlock: false,
        inMapping: false,
        inArray: false,
        inMultiLineString: false,
        inInheritBlock: false,
        inVarargs: false,
        inSquareBracketMapping: false,
        inExitsMapping: false, // 添加新状态标志用于跟踪 set("exits", ([...])) 结构
        ifWithoutBrace: false, // 是否是没有大括号的if语句
        functionCommentBlock: false, // 是否在函数注释块内
        lastLineWasBrace: false, // 上一行是否是大括号
        lastLineWasIf: false, // 上一行是否是if语句
        pendingBrace: false // 是否需要添加大括号到新行
    };
    const specialBlocks = {
        start: new Set(["@LONG", "@TEXT", "@HELP"]),
        end: new Set(["LONG", "TEXT", "HELP"])
    };
    // 预处理：检测函数声明
    const functionPattern = /^([\w\*]+\s+)+[\w_]+\s*\(/;
    const inheritPattern = /^\s*inherit\s+/;
    const includePattern = /^\s*#include\s+/;
    const definePattern = /^\s*#define\s+/;
    const mappingPattern = /\bmapping\s*\(/;
    const arrayPattern = /\(\{\s*$/;
    const squareBracketMappingStartPattern = /\(\[\s*$/;
    const switchPattern = /\bswitch\s*\(/;
    const casePattern = /^\s*case\s+/;
    const defaultPattern = /^\s*default\s*:/;
    const inheritBlockPattern = /^\s*::\s*\{/;
    const arrowPattern = /->/;
    const varargsPattern = /\.\.\./;
    const ifPattern = /^\s*if\s*\(/;
    const elsePattern = /^\s*else\s*/;
    const elseIfPattern = /^\s*else\s+if\s*\(/;
    const forPattern = /^\s*for\s*\(/;
    const whilePattern = /^\s*while\s*\(/;
    const doPattern = /^\s*do\s*/;
    const returnPattern = /^\s*return\s+/;
    const functionCommentPattern = /^\s*\/\*\*\s*/;
    const commentEndPattern = /\*\/\s*$/;
    const singleLineCommentPattern = /^\s*\/\//;
    const blockCommentStartPattern = /^\s*\/\*/;
    const blockCommentEndPattern = /\*\/\s*$/;
    const preprocessorDirectivePattern = /^\s*#(if|ifdef|ifndef|else|elif|endif|undef|line|pragma|error|warning)/;
    // 处理连续空行
    let consecutiveEmptyLines = 0;
    const maxConsecutiveEmptyLines = 2;
    // 启用 console.log 来帮助调试
    // console.log("[formatter.ts] formatLPCCode START with code length: " + code.length);
    // 第一遍：分析代码结构 (Purpose: Trim lines of function comments)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim(); // Current line being checked if it's a function declaration
        // Analyze function declarations for preceding block comments
        if (functionPattern.test(line) && !line.endsWith(";")) {
            let potentialCommentEndLine = i - 1;
            // Skip empty lines and single-line comments upwards from function
            while (potentialCommentEndLine >= 0 &&
                (lines[potentialCommentEndLine].trim() === '' || singleLineCommentPattern.test(lines[potentialCommentEndLine]))) {
                potentialCommentEndLine--;
            }
            if (potentialCommentEndLine >= 0 && blockCommentEndPattern.test(lines[potentialCommentEndLine])) {
                // Found a line ending with */. This is potentially the end of the func comment.
                let potentialCommentStartLine = potentialCommentEndLine;
                // Scan upwards to find the start of this comment block (line with /*)
                while (potentialCommentStartLine >= 0) {
                    if (blockCommentStartPattern.test(lines[potentialCommentStartLine])) {
                        // Found the start. Now trim lines from potentialCommentStartLine to potentialCommentEndLine.
                        // This ensures that if a comment like /* Blah */ is used for a function, its lines are trimmed.
                        for (let l = potentialCommentStartLine; l <= potentialCommentEndLine; l++) {
                            lines[l] = lines[l].trim(); // Trim the original lines array
                        }
                        break; // Found and processed the comment block
                    }
                    // Safety break: if we are looking upwards for /* but hit another */, something is wrong.
                    if (potentialCommentStartLine < potentialCommentEndLine && blockCommentEndPattern.test(lines[potentialCommentStartLine])) {
                        break;
                    }
                    // Safety break: if the comment starts looking too far, break.
                    if (potentialCommentEndLine - potentialCommentStartLine > 20) { // Arbitrary limit for very long comments
                        break;
                    }
                    potentialCommentStartLine--;
                }
            }
        }
    }
    // 第二遍：格式化代码
    // // console.log("[formatter.ts] Starting second pass..."); // 添加日志
    for (let i = 0; i < lines.length; i++) {
        // // console.log(`[formatter.ts] Processing line ${i + 1}: ${lines[i]}`); // 添加日志
        if (typeof lines[i] === 'undefined') {
            // // console.error(`[formatter.ts] Error: Line ${i + 1} is undefined. Stopping processing.`);
            // // console.error(`[formatter.ts] Current lines array (or part of it):`, lines.slice(Math.max(0, i-5), i+5));
            break;
        }
        const line = lines[i];
        const trimmed = line.trim();
        const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
        const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
        // --- BEGIN NEW SPECIAL BLOCK HANDLING (handles lines INSIDE or ENDING a block) ---
        if (state.inSpecialBlock) {
            result.push(line); // Push raw line from inside @LONG or the LONG line itself
            if (specialBlocks.end.has(trimmed)) {
                state.inSpecialBlock = false; // End the block AFTER this line
            }
            continue; // Skip all other formatting for this line
        }
        // --- END NEW SPECIAL BLOCK HANDLING ---
        // Handle preprocessor directives (#if, #else, #endif, etc.)
        // These should not be indented.
        if (preprocessorDirectivePattern.test(trimmed)) {
            result.push(trimmed);
            continue;
        }
        // 处理函数注释块 (/** ... */)
        if (functionCommentPattern.test(trimmed) && !state.inBlockComment) {
            // 函数注释块不缩进
            result.push(trimmed);
            if (!commentEndPattern.test(trimmed)) {
                state.functionCommentBlock = true;
            }
            continue;
        }
        if (state.functionCommentBlock) {
            result.push(trimmed);
            if (commentEndPattern.test(trimmed)) {
                state.functionCommentBlock = false;
            }
            continue;
        }
        // 处理普通文档注释块 (/* ... */)
        if (blockCommentStartPattern.test(trimmed) && !functionCommentPattern.test(trimmed) && !state.inBlockComment) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            if (!blockCommentEndPattern.test(trimmed)) {
                state.inBlockComment = true;
            }
            continue;
        }
        if (state.inBlockComment) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            if (blockCommentEndPattern.test(trimmed)) {
                state.inBlockComment = false;
            }
            continue;
        }
        // 处理空行
        if (trimmed === '') {
            // 限制连续空行数量
            if (consecutiveEmptyLines < maxConsecutiveEmptyLines) {
                result.push('');
                consecutiveEmptyLines++;
            }
            continue;
        }
        else {
            consecutiveEmptyLines = 0;
        }
        // 处理单行注释
        if (singleLineCommentPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理预处理指令（#include, #define等）
        if (includePattern.test(trimmed) || definePattern.test(trimmed)) {
            result.push(trimmed.replace(/^(#(?:include|define))\s+/, '$1 '));
            continue;
        }
        // 处理inherit语句
        if (inheritPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理::继承块
        if (inheritBlockPattern.test(trimmed)) {
            state.inInheritBlock = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            continue;
        }
        // 处理多行字符串
        if (state.inMultiLineString) {
            if (trimmed.includes('"') && !trimmed.startsWith('\\')) {
                state.inMultiLineString = false;
                // 多行字符串结束行使用当前缩进
                const indentStr = " ".repeat(indentLevel * indentSize);
                result.push(indentStr + trimmed);
            }
            else {
                // 多行字符串内容保持原样或增加一级缩进
                // For multi-line string content, push the raw line or indent it slightly
                // Let's try pushing raw line to see effect
                result.push(line);
            }
            continue;
        }
        // 检测多行字符串开始
        if (trimmed.startsWith('"') && !trimmed.endsWith('"') &&
            !trimmed.endsWith('\\') && !trimmed.endsWith(';')) {
            state.inMultiLineString = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理函数声明
        if (functionPattern.test(trimmed) && !trimmed.endsWith(";")) {
            state.inFunctionDeclaration = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理函数声明末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果下一行是大括号，标记为不需要添加大括号
                if (nextTrimmed === '{') {
                    // 下一行会处理大括号
                }
                else {
                    state.pendingBrace = true;
                }
            }
            // 检查是否有函数参数
            if (trimmed.includes('(') && !trimmed.includes(')')) {
                state.inFunctionParams = true;
            }
            continue;
        }
        // 处理函数参数
        if (state.inFunctionParams) {
            const indentStr = " ".repeat((indentLevel + 1) * indentSize);
            result.push(indentStr + trimmed);
            if (trimmed.includes(')')) {
                state.inFunctionParams = false;
                // 如果函数参数后面跟着{，增加缩进级别
                if (trimmed.endsWith('{')) {
                    indentLevel++;
                    state.lastLineWasBrace = true;
                }
            }
            continue;
        }
        // 处理if语句
        if (ifPattern.test(trimmed) || elseIfPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理if语句末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果if语句后面没有{，但也没有;结尾，则增加缩进
                if (!trimmed.includes('{') && !trimmed.endsWith(';')) {
                    if (nextTrimmed === '{') {
                        // 下一行会处理大括号
                    }
                    else {
                        state.pendingBrace = true;
                        indentLevel++;
                        state.ifWithoutBrace = true;
                    }
                }
            }
            state.lastLineWasIf = true;
            continue;
        }
        // 处理else语句
        if (elsePattern.test(trimmed) && !elseIfPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理else语句末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果else语句后面有{，增加缩进
                if (nextTrimmed === '{') {
                    // 下一行会处理大括号
                }
                else if (!trimmed.endsWith(';')) {
                    // 如果else后面没有{，但也不是单行语句，增加缩进
                    state.pendingBrace = true;
                    indentLevel++;
                    state.ifWithoutBrace = true;
                }
            }
            continue;
        }
        // 处理for/while/do语句
        if (forPattern.test(trimmed) || whilePattern.test(trimmed) || doPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理控制结构末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果语句后面没有{，但也不是单行语句，增加缩进
                if (!trimmed.endsWith(';')) {
                    if (nextTrimmed === '{') {
                        // 下一行会处理大括号
                    }
                    else {
                        state.pendingBrace = true;
                        indentLevel++;
                    }
                }
            }
            continue;
        }
        // 处理return语句
        if (returnPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果是没有大括号的if块中的return语句，减少缩进
            if (state.ifWithoutBrace && trimmed.endsWith(';')) {
                indentLevel--;
                state.ifWithoutBrace = false;
                state.pendingBrace = false; // Clear pendingBrace
            }
            continue;
        }
        // 处理可变参数
        // 处理switch语句
        if (switchPattern.test(trimmed)) {
            state.inSwitchBlock = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理switch语句末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果下一行是大括号，标记为不需要添加大括号
                if (nextTrimmed === '{') {
                    // 下一行会处理大括号
                }
                else {
                    state.pendingBrace = true;
                }
            }
            continue;
        }
        // 处理case语句
        if (state.inSwitchBlock && (casePattern.test(trimmed) || defaultPattern.test(trimmed))) {
            state.inCaseBlock = true;
            // case语句缩进比switch少一级
            const indentStr = " ".repeat((indentLevel - 1) * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理mapping和数组
        if (mappingPattern.test(trimmed)) {
            state.inMapping = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 处理mapping末尾的大括号
            if (trimmed.endsWith('{')) {
                // 移除末尾的大括号
                const lineWithoutBrace = trimmed.substring(0, trimmed.length - 1).trim();
                result.push(indentStr + lineWithoutBrace);
                // 添加大括号到新行
                result.push(indentStr + "{");
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else {
                result.push(indentStr + trimmed);
                // 如果下一行是大括号，标记为不需要添加大括号
                if (nextTrimmed === '{') {
                    // 下一行会处理大括号
                }
                else {
                    state.pendingBrace = true;
                }
            }
            continue;
        }
        if (arrayPattern.test(trimmed)) {
            state.inArray = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            state.lastLineWasBrace = true;
            continue;
        }
        // Handling for '([' square bracket mapping start
        if (squareBracketMappingStartPattern.test(trimmed)) {
            state.inSquareBracketMapping = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            state.lastLineWasBrace = true; // Consider '([' like an opening brace for indentation
            continue;
        }
        // 处理大括号 (Generic '{' opener)
        if (trimmed === '{') {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            state.lastLineWasBrace = true;
            state.pendingBrace = false; // 已处理待添加的大括号
            continue;
        }
        // Handle LPC-specific '])' and '}))' closers
        if (trimmed.endsWith('])') && state.inSquareBracketMapping) {
            // 确保缩进是一致的
            indentLevel = Math.max(0, indentLevel - 1);
            const indentStr = " ".repeat(indentLevel * indentSize);
            let formattedLine = formatLinePreservingStrings(trimmed);
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            state.inSquareBracketMapping = false;
            state.lastLineWasBrace = true; // Consider '])' like a closing brace
            continue;
        }
        if (trimmed.endsWith('})') && state.inArray) {
            indentLevel = Math.max(0, indentLevel - 1);
            const indentStr = " ".repeat(indentLevel * indentSize);
            let formattedLine = formatLinePreservingStrings(trimmed);
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            state.inArray = false;
            state.lastLineWasBrace = true; // Consider '})' like a closing brace
            continue;
        }
        // Generic '}' closer (ensure it doesn't re-process '})' due to startsWith)
        // This is okay if the specific '})' handler above has `continue`.
        if (trimmed === '}' || (trimmed.startsWith('}') && !trimmed.endsWith('])') && !trimmed.endsWith('})'))) {
            // console.log(`[formatter.ts] Generic '}' found. Current indentLevel: ${indentLevel}, trimmed: '${trimmed}'`); // DEBUG LOG
            indentLevel = Math.max(0, indentLevel - 1);
            // // console.log(`[formatter.ts] Generic '}' after decrement. New indentLevel: ${indentLevel}`); // DEBUG LOG
            const indentStr = " ".repeat(indentLevel * indentSize);
            let formattedLine = formatLinePreservingStrings(trimmed);
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            // End various blocks closed by a simple '}'
            if (state.inSwitchBlock && trimmed === '}') {
                state.inSwitchBlock = false;
            }
            if (state.inCaseBlock && trimmed === '}') { // This logic might need review: case blocks don't end with '}'
                state.inCaseBlock = false;
            }
            if (state.inMapping && trimmed === '}') { // For mapping(...) { ... }
                state.inMapping = false;
            }
            if (state.inFunctionDeclaration && trimmed === '}') {
                state.inFunctionDeclaration = false;
            }
            if (state.inInheritBlock && trimmed === '}') {
                state.inInheritBlock = false;
            }
            // Check if this was the closing brace for an if/else without braces
            if (state.ifWithoutBrace && state.pendingBrace) {
                // This case should ideally not happen if pendingBrace is handled correctly
                // or if single statement if/else correctly decrements indent.
                // For now, let's assume the indentLevel was already handled.
            }
            else if (state.ifWithoutBrace) {
                // This '}' might be closing a single-statement block that we artifically opened.
                // However, typical single statements end with ';', not '}'
            }
            state.lastLineWasBrace = true;
            continue;
        }
        else {
            state.lastLineWasBrace = false;
        }
        // 处理case块内的语句
        if (state.inCaseBlock && !casePattern.test(trimmed) && !defaultPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 处理mapping, 数组, 和 ([ ]) 内的元素
        if ((state.inMapping || state.inArray || state.inSquareBracketMapping) &&
            !trimmed.startsWith('mapping') && // Avoid reprocessing mapping() opening line
            !trimmed.startsWith('({') && // Avoid reprocessing ({ array opening line
            !trimmed.startsWith('([') && // Avoid reprocessing ([ mapping opening line
            !trimmed.startsWith('}') && // General block end
            !trimmed.startsWith('})') && // ({ ... }) array end
            !trimmed.startsWith('])')) { // ([ ... ]) mapping end - 这里修复了之前的 ']]))'
            // 确保正确的缩进级别
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 处理->箭头操作符的链式调用
        if (arrowPattern.test(trimmed) && trimmed.startsWith('->')) {
            const indentStr = " ".repeat((indentLevel + 1) * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 提前检测 set("exits"...) 行，并应用特殊处理
        if (trimmed.includes('set("exits"')) {
            // 确保它和其他 set 语句有相同的缩进
            const indentStr = " ".repeat(indentLevel * indentSize);
            if (trimmed.endsWith('([')) {
                // 这是映射的开始
                result.push(indentStr + trimmed);
                state.inExitsMapping = true;
                state.inSquareBracketMapping = true;
                indentLevel++;
                continue;
            }
        }
        // 处理 set("exits", ([...]) 结构的内容
        if (state.inExitsMapping && !trimmed.endsWith(']);')) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            let formattedLine = formatLinePreservingStrings(trimmed);
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 处理 set("exits", ([...]) 结构的结束
        if (state.inExitsMapping && trimmed.endsWith(']);')) {
            // 减少缩进等级
            indentLevel = Math.max(0, indentLevel - 1);
            // 设置当前行的正确缩进
            const indentStr = " ".repeat(indentLevel * indentSize);
            let formattedLine = formatLinePreservingStrings(trimmed);
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            // 重置标志
            state.inExitsMapping = false;
            state.inSquareBracketMapping = false;
            continue;
        }
        // 应用缩进
        const indentStr = " ".repeat(indentLevel * indentSize);
        // 不要修改多行字符串的内容 (This part seems to be for a different type of multi-line string)
        // The main multi-line string logic is above. Let's assume formatLinePreservingStrings handles normal strings.
        let formattedLine = formatLinePreservingStrings(trimmed);
        formattedLine = formatLPCSpecificSyntax(formattedLine);
        result.push(indentStr + formattedLine);
        // --- BEGIN SETTING state.inSpecialBlock FOR NEXT LINE (handles lines INITIATING a block) ---
        // Note: This runs AFTER the current line has been pushed.
        // The `continue` in the `state.inSpecialBlock` check at the top ensures this logic
        // isn't re-evaluated if we were already in a block.
        if (!state.inSpecialBlock) { // Double check we are not setting it if it was just turned off by "LONG"
            let currentLineInitiatesSpecialBlock = false;
            if (specialBlocks.start.has(trimmed)) { // Line is exactly "@LONG" etc.
                currentLineInitiatesSpecialBlock = true;
            }
            else {
                for (const token of specialBlocks.start) {
                    // Check if line ends with the token, possibly preceded by space, '=', ',', or '('.
                    if (trimmed.endsWith(token) || trimmed.endsWith(" " + token) || trimmed.endsWith("=" + token) || trimmed.endsWith("," + token) || trimmed.endsWith("(" + token)) {
                        currentLineInitiatesSpecialBlock = true;
                        break;
                    }
                }
            }
            if (currentLineInitiatesSpecialBlock) {
                state.inSpecialBlock = true; // Set for the *next* iteration
            }
        }
        // --- END SETTING state.inSpecialBlock FOR NEXT LINE ---
        // Handle indentation for single-line statements after if/else without braces
        if (state.ifWithoutBrace && trimmed.endsWith(';')) {
            indentLevel = Math.max(0, indentLevel - 1);
            state.ifWithoutBrace = false;
            state.pendingBrace = false; // Clear pendingBrace as the block is now closed
        }
        // 重置上一行状态
        state.lastLineWasIf = false;
    }
    // // console.log("[formatter.ts] Main processing loop FINISHED. Result lines collected:", result.length); // DIAGNOSTIC LOG
    // // console.log("[formatter.ts] Preparing to join result. Result length:", result.length); // DIAGNOSTIC LOG
    const finalResult = result.join('\n');
    // // console.log("[formatter.ts] formatLPCCode END. Final string length:", finalResult.length); // DIAGNOSTIC LOG
    return finalResult;
}
// 格式化一行代码，但保护字符串内容不被修改
function formatLinePreservingStrings(line) {
    // 提取所有字符串
    const strings = [];
    const stringPlaceholder = "___STRING_PLACEHOLDER___";
    // 临时替换字符串为占位符
    let processedLine = line.replace(/"(?:\\"|[^"])*"/g, (match) => {
        strings.push(match);
        return stringPlaceholder + (strings.length - 1);
    });
    // 提取所有字符
    const chars = [];
    const charPlaceholder = "___CHAR_PLACEHOLDER___";
    // 临时替换字符为占位符
    processedLine = processedLine.replace(/'(?:\\'|[^'])*'/g, (match) => {
        chars.push(match);
        return charPlaceholder + (chars.length - 1);
    });
    // 提取所有注释
    const comments = [];
    const commentPlaceholder = "___COMMENT_PLACEHOLDER___";
    // 临时替换单行注释为占位符
    processedLine = processedLine.replace(/\/\/.*$/g, (match) => {
        comments.push(match);
        return commentPlaceholder + (comments.length - 1);
    });
    // 保存原始操作符，避免被错误分割
    // 保存复合操作符
    const compoundOps = [];
    const compoundOpPlaceholder = "___COMPOUND_OP_PLACEHOLDER___";
    // 保存 ==, !=, >=, <=
    processedLine = processedLine.replace(/(==|!=|>=|<=)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 +=, -=, *=, /=, %=
    processedLine = processedLine.replace(/(\+=|-=|\*=|\/=|%=)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 &&, ||
    processedLine = processedLine.replace(/(&&|\|\|)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 ->
    processedLine = processedLine.replace(/(->)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 ::
    processedLine = processedLine.replace(/(::)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // Format assignment operator =
    // Handles a=b, a =b, a= b, a = b. Ensures ' = '.
    // Example: a=-b -> a = -b. This is processed before other operators.
    // Example: a=b+c -> a = b+c
    processedLine = processedLine.replace(/(\S)\s*=\s*(\S)/g, '$1 = $2');
    // Format colons : (e.g. for mappings or case statements)
    // Example: "key":val -> "key" : val
    processedLine = processedLine.replace(/(\S)\s*:\s*(\S)/g, '$1 : $2');
    // Format binary operators: +, *, /, %, <, >
    // These are processed after assignment and colons.
    // \S ensures we are matching non-whitespace characters around the operator.
    processedLine = processedLine.replace(/(\S)\s*([+*\/%<>])\s*(\S)/g, (match, g1, op, g3) => {
        // Ensure that g1 and g3 are not part of a placeholder (very unlikely with \S but good to be mindful)
        // A more robust check might involve checking if g1 or g3 end/start with ___PLACEHOLDER___ patterns.
        // However, \S should not match space, so it won't span across placeholders easily.
        return `${g1} ${op} ${g3}`;
    });
    // Format binary minus (-), carefully to distinguish from unary minus.
    // A binary minus is typically preceded by a word character, digit, closing parenthesis, or closing bracket.
    // And followed by a word character, digit, opening parenthesis, or opening bracket.
    // Example: var-var, var-1, 1-var, (expr)-var, var-(expr)
    processedLine = processedLine.replace(/([\w\d)\]])\s*(-)\s*([\w\d(\[])/g, '$1 $2 $3');
    // Restore compound operators and ensure proper spacing around them
    for (let i = 0; i < compoundOps.length; i++) {
        const op = compoundOps[i];
        if (op === '->') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' -> ');
        }
        else if (op === '::') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' :: ');
        }
        else if (op === '==' || op === '!=' || op === '>=' || op === '<=') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
        else if (op === '&&' || op === '\|\|') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
        else {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
    }
    // 修复逗号后面的空格
    processedLine = processedLine.replace(/,\s*/g, ', ');
    // 修复分号前的空格
    processedLine = processedLine.replace(/\s*;/g, ';');
    // 修复括号内外的空格
    processedLine = processedLine.replace(/\(\s+/g, '(');
    processedLine = processedLine.replace(/\s+\)/g, ')');
    // 修复方括号内外的空格
    processedLine = processedLine.replace(/\[\s+/g, '[');
    processedLine = processedLine.replace(/\s+\]/g, ']');
    // 修复大括号内外的空格 (保持开大括号单独一行的风格)
    if (processedLine.trim() === '{') {
        processedLine = '{';
    }
    else if (processedLine.trim() === '}') {
        processedLine = '}';
    }
    else {
        processedLine = processedLine.replace(/\{\s+/g, '{');
        processedLine = processedLine.replace(/\s+\}/g, '}');
    }
    // 修复多余的空格
    processedLine = processedLine.replace(/\s{2,}/g, ' ');
    // 恢复注释
    for (let i = 0; i < comments.length; i++) {
        processedLine = processedLine.replace(commentPlaceholder + i, comments[i]);
    }
    // 恢复字符
    for (let i = 0; i < chars.length; i++) {
        processedLine = processedLine.replace(charPlaceholder + i, chars[i]);
    }
    // 恢复字符串
    for (let i = 0; i < strings.length; i++) {
        processedLine = processedLine.replace(stringPlaceholder + i, strings[i]);
    }
    return processedLine;
}
// 格式化LPC特有的语法
function formatLPCSpecificSyntax(line) {
    let result = line;
    // 格式化类型转换 ((type)var)
    result = result.replace(/\(\s*(\w+)\s*\)\s*(\w+)/g, '($1)$2');
    // 格式化数组访问 (arr[idx])
    result = result.replace(/(\w+)\s*\[\s*(\w+|\d+)\s*\]/g, '$1[$2]');
    // 格式化函数调用 (func(args))
    result = result.replace(/(\w+)\s*\(\s*/g, '$1(');
    result = result.replace(/\s*\)/g, ')');
    // 格式化mapping访问 (map["key"])
    result = result.replace(/(\w+)\s*\[\s*"([^"]*)"\s*\]/g, '$1["$2"]');
    // 格式化可变参数语法 (...)
    result = result.replace(/\s*\.\.\.\s*/g, '...');
    // 格式化LPC特有的作用域操作符 (::)
    result = result.replace(/(\w+)\s*::\s*(\w+)/g, '$1::$2');
    // 格式化LPC的空值检查 nullp()
    result = result.replace(/nullp\s*\(\s*/g, 'nullp(');
    // 格式化LPC的数组操作如 member_array()
    result = result.replace(/member_array\s*\(\s*/g, 'member_array(');
    // 格式化LPC中的字符串
    result = result.replace(/\+\s*"/g, '+ "');
    result = result.replace(/"\s*\+/g, '" +');
    // 格式化LPC中的映射声明和操作
    // Ensure no space immediately inside ([ and ]) for mapping declarations themselves
    result = result.replace(/\(\s*\[\s*/g, '(['); // e.g. mapping x = ([ ...
    result = result.replace(/\s*\]\s*\)/g, '])'); // e.g. ... ]);
    // Spacing for single-line mapping literals
    // Empty: ([]) -> ([ ])
    result = result.replace(/\(\[\s*\]\)/g, '([ ])');
    // Non-empty: ([ "key": value ]) -> ([ "key": value ]) (ensuring one space padding)
    result = result.replace(/\(\[\s*(.+?)\s*\]\)/g, (match, content) => {
        // Avoid re-mangling content that might be complex (e.g. already contains placeholders)
        if (content.includes("___STRING_PLACEHOLDER___") || content.includes("___COMMENT_PLACEHOLDER___") || content.trim() !== content) {
            return match; // If content itself has leading/trailing spaces or placeholders, trust prior formatting.
        }
        return `([ ${content.trim()} ])`;
    });
    // Spacing for single-line array literals
    // Empty: ({}) -> ({ })
    result = result.replace(/\(\{\s*\}\)/g, '({ })');
    // Non-empty: ({ val1, val2 }) -> ({ val1, val2 }) (ensuring one space padding)
    result = result.replace(/\(\{\s*(.+?)\s*\}\)/g, (match, content) => {
        if (content.includes("___STRING_PLACEHOLDER___") || content.includes("___COMMENT_PLACEHOLDER___") || content.trim() !== content) {
            return match;
        }
        return `({ ${content.trim()} })`;
    });
    // Ensure no space after # for function pointers like #'func or #"func"
    result = result.replace(/#\s+(['"])/g, "#$1");
    // Ensure space after (: and before :) for closures.
    // e.g., (:ob,func:) -> (: ob, func :)
    // Comma spacing between elements is handled by formatLinePreservingStrings.
    result = result.replace(/\(:\s*(?!\s)/g, '(: '); // Add space after (: if not already there, but not if already '(: '
    result = result.replace(/(?<!\s)\s*:\)/g, ' :)'); // Add space before :) if not already there, but not if already ' :)'
    // 格式化LPC中的索引访问 (e.g. arr[idx], map[key]) - already partially covered
    // This rule is more specific for index part of an array/mapping access
    result = result.replace(/\[\s*([^,\s]+)\s*\]/g, '[$1]'); // map[ "key" ] -> map["key"], arr[ i ] -> arr[i]
    return result;
}
//# sourceMappingURL=formatter.js.map