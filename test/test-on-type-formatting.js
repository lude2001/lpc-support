/**
 * 测试输入时格式化功能
 * 模拟用户在不同位置输入特殊字符时的格式化行为
 */

const fs = require('fs');
const path = require('path');

function testOnTypeFormatting() {
    console.log('LPC 输入时格式化测试');
    console.log('=====================\n');
    
    // 创建测试场景
    const testScenarios = [
        {
            name: '闭合大括号 "}" 格式化',
            description: '在函数体或代码块结束时输入 "}"',
            testCases: [
                {
                    context: [
                        'int test_function() {',
                        '    int x = 1;',
                        '    return x;',
                        '        }' // 不正确的缩进
                    ],
                    character: '}',
                    position: { line: 3, character: 9 }, // 在 } 之后
                    expected: '调整 "}" 的缩进到正确的级别'
                },
                {
                    context: [
                        'mapping test = ({',
                        '    "key": "value"',
                        '        }); // 不正确的缩进'
                    ],
                    character: '}',
                    position: { line: 2, character: 9 },
                    expected: '调整 "}" 的缩进到正确的级别'
                }
            ]
        },
        {
            name: '分号 ";" 格式化',
            description: '在语句结束时输入 ";"',
            testCases: [
                {
                    context: [
                        'int x = 10   ;' // 分号前有多余空格
                    ],
                    character: ';',
                    position: { line: 0, character: 13 },
                    expected: '移除分号前的多余空格'
                },
                {
                    context: [
                        'return 5;int y = 3;' // 分号后缺少空格
                    ],
                    character: ';',
                    position: { line: 0, character: 8 },
                    expected: '在分号后添加空格（如果后面不是行尾）'
                }
            ]
        },
        {
            name: '闭合小括号 ")" 格式化',
            description: '在函数调用或条件语句中输入 ")"',
            testCases: [
                {
                    context: [
                        'if (condition   ) {' // 小括号前有多余空格
                    ],
                    character: ')',
                    position: { line: 0, character: 16 },
                    expected: '移除闭合括号前的多余空格'
                },
                {
                    context: [
                        'if (condition){' // 小括号后缺少空格
                    ],
                    character: ')',
                    position: { line: 0, character: 13 },
                    expected: '在闭合括号后添加空格（如果后面是 "{"）'
                }
            ]
        }
    ];
    
    // 执行测试场景
    testScenarios.forEach((scenario, index) => {
        console.log(`测试场景 ${index + 1}: ${scenario.name}`);
        console.log('-'.repeat(scenario.name.length + 15));
        console.log(`描述: ${scenario.description}\n`);
        
        scenario.testCases.forEach((testCase, caseIndex) => {
            console.log(`  案例 ${caseIndex + 1}:`);
            console.log(`    输入上下文:`);
            testCase.context.forEach((line, lineIndex) => {
                const marker = lineIndex === testCase.position.line ? 
                    ' '.repeat(testCase.position.character) + '^' : '';
                console.log(`      ${lineIndex}: ${line}`);
                if (marker.trim()) {
                    console.log(`         ${marker}`);
                }
            });
            
            console.log(`    输入字符: "${testCase.character}"`);
            console.log(`    位置: 行 ${testCase.position.line}, 列 ${testCase.position.character}`);
            console.log(`    预期行为: ${testCase.expected}`);
            
            // 模拟格式化逻辑
            const formatResult = simulateOnTypeFormatting(
                testCase.context,
                testCase.position,
                testCase.character
            );
            
            if (formatResult.edits.length > 0) {
                console.log(`    格式化编辑:`);
                formatResult.edits.forEach((edit, editIndex) => {
                    console.log(`      ${editIndex + 1}. ${edit.description}`);
                    console.log(`         范围: (${edit.range.start.line},${edit.range.start.character}) 到 (${edit.range.end.line},${edit.range.end.character})`);
                    console.log(`         新文本: "${edit.newText}"`);
                });
            } else {
                console.log(`    格式化编辑: 无需格式化`);
            }
            
            console.log('');
        });
        
        console.log('');
    });

    // 从实际文件中测试一些场景
    console.log('从实际测试文件中提取的场景');
    console.log('==========================\n');
    
    const testFile = path.join(__dirname, 'yifeng-jian.c');
    if (fs.existsSync(testFile)) {
        const content = fs.readFileSync(testFile, 'utf8');
        const lines = content.split('\n');
        
        // 找一些有问题的行进行测试
        const problematicLines = findProblematicLines(lines);
        
        problematicLines.forEach((lineInfo, index) => {
            console.log(`实际案例 ${index + 1}: 行 ${lineInfo.lineNumber + 1}`);
            console.log(`原始内容: ${lineInfo.content}`);
            console.log(`问题类型: ${lineInfo.issues.join(', ')}`);
            
            // 模拟在该行末尾输入分号或其他字符
            if (lineInfo.content.endsWith(',')) {
                const pos = { line: lineInfo.lineNumber, character: lineInfo.content.length };
                const result = simulateOnTypeFormatting([lineInfo.content], 
                    { line: 0, character: pos.character - 1 }, ',');
                
                if (result.edits.length > 0) {
                    console.log(`如果重新输入 "," 的格式化建议:`);
                    result.edits.forEach(edit => {
                        console.log(`  - ${edit.description}`);
                    });
                }
            }
            console.log('');
        });
    }
}

function simulateOnTypeFormatting(lines, position, character) {
    const result = { edits: [] };
    const currentLine = lines[position.line] || '';
    
    switch (character) {
        case '}':
            return simulateFormatClosingBrace(lines, position, result);
        case ';':
            return simulateFormatSemicolon(lines, position, result);
        case ')':
            return simulateFormatClosingParen(lines, position, result);
        default:
            return result;
    }
}

function simulateFormatClosingBrace(lines, position, result) {
    const currentLine = lines[position.line] || '';
    const trimmedLine = currentLine.trim();
    
    if (trimmedLine === '}') {
        // 计算应有的缩进级别
        const indentLevel = calculateBraceIndentLevel(lines, position.line);
        const currentIndent = currentLine.length - currentLine.trimLeft().length;
        
        if (currentIndent !== indentLevel) {
            result.edits.push({
                description: `调整 "}" 的缩进从 ${currentIndent} 到 ${indentLevel} 个空格`,
                range: {
                    start: { line: position.line, character: 0 },
                    end: { line: position.line, character: currentLine.length }
                },
                newText: ' '.repeat(indentLevel) + '}'
            });
        }
    }
    
    return result;
}

function simulateFormatSemicolon(lines, position, result) {
    const currentLine = lines[position.line] || '';
    const beforeSemicolon = currentLine.substring(0, position.character - 1);
    const afterSemicolon = currentLine.substring(position.character);
    
    // 检查分号前的多余空格
    const trimmedBefore = beforeSemicolon.replace(/\s+$/, '');
    if (trimmedBefore !== beforeSemicolon) {
        result.edits.push({
            description: '移除分号前的多余空格',
            range: {
                start: { line: position.line, character: trimmedBefore.length },
                end: { line: position.line, character: position.character - 1 }
            },
            newText: ''
        });
    }
    
    // 检查分号后是否需要空格
    if (afterSemicolon.trim() !== '' && !afterSemicolon.startsWith(' ')) {
        result.edits.push({
            description: '在分号后添加空格',
            range: {
                start: { line: position.line, character: position.character },
                end: { line: position.line, character: position.character }
            },
            newText: ' '
        });
    }
    
    return result;
}

function simulateFormatClosingParen(lines, position, result) {
    const currentLine = lines[position.line] || '';
    const beforeParen = currentLine.substring(0, position.character - 1);
    const afterParen = currentLine.substring(position.character);
    
    // 检查闭合括号前的多余空格
    const trimmedBefore = beforeParen.replace(/\s+$/, '');
    if (trimmedBefore !== beforeParen) {
        result.edits.push({
            description: '移除闭合括号前的多余空格',
            range: {
                start: { line: position.line, character: trimmedBefore.length },
                end: { line: position.line, character: position.character - 1 }
            },
            newText: ''
        });
    }
    
    // 检查括号后是否需要空格（如果后面是 {）
    if (afterParen.trim().startsWith('{') && !afterParen.startsWith(' ')) {
        result.edits.push({
            description: '在闭合括号后添加空格（在 "{" 之前）',
            range: {
                start: { line: position.line, character: position.character },
                end: { line: position.line, character: position.character }
            },
            newText: ' '
        });
    }
    
    return result;
}

function calculateBraceIndentLevel(lines, lineIndex) {
    let braceCount = 0;
    
    // 从当前行向上扫描，找到匹配的开放括号
    for (let i = lineIndex - 1; i >= 0; i--) {
        const line = lines[i];
        
        if (line.includes('{')) {
            braceCount++;
            if (braceCount > 0) {
                // 返回开放括号所在行的缩进级别
                return line.length - line.trimLeft().length;
            }
        }
        
        if (line.includes('}')) {
            braceCount--;
        }
    }
    
    return 0; // 默认无缩进
}

function findProblematicLines(lines) {
    const problematic = [];
    
    lines.forEach((line, index) => {
        const issues = [];
        
        // 检查空格问题
        if (line.includes('  :') || line.includes(':  ') || line.includes(' :')) {
            issues.push('冒号空格问题');
        }
        
        if (line.includes('  ,') || line.includes(' ,')) {
            issues.push('逗号前多余空格');
        }
        
        // 检查缩进问题
        const indent = line.length - line.trimLeft().length;
        if (indent > 0 && indent % 4 !== 0 && line.trim() !== '') {
            issues.push('缩进不是4的倍数');
        }
        
        // 检查运算符空格
        if (line.match(/\S[=<>!]=?\S/)) {
            issues.push('运算符缺少空格');
        }
        
        if (issues.length > 0) {
            problematic.push({
                lineNumber: index,
                content: line,
                issues: issues
            });
        }
    });
    
    // 只返回前5个问题行
    return problematic.slice(0, 5);
}

// 运行测试
testOnTypeFormatting();