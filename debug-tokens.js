const { CharStreams, CommonTokenStream } = require('antlr4ts');
const { LPCLexer } = require('./dist/src/antlr/LPCLexer');

function debugTokens(input) {
    console.log(`\n调试输入: ${JSON.stringify(input)}`);
    console.log('='.repeat(50));
    
    try {
        const inputStream = CharStreams.fromString(input);
        const lexer = new LPCLexer(inputStream);
        const tokenStream = new CommonTokenStream(lexer);
        
        // 获取所有Token
        tokenStream.fill();
        const tokens = tokenStream.getTokens();
        
        console.log(`总Token数量: ${tokens.length}`);
        console.log('');
        
        tokens.forEach((token, index) => {
            if (token.type !== -1) { // 跳过EOF
                console.log(`Token ${index}:`);
                console.log(`  类型: ${token.type}`);
                console.log(`  文本: ${JSON.stringify(token.text)}`);
                console.log(`  位置: 行${token.line}, 列${token.charPositionInLine}`);
                console.log('');
            }
        });
        
    } catch (error) {
        console.error('解析错误:', error);
    }
}

// 测试各种操作符
console.log('LPC Token 分析器调试工具');
console.log('=' .repeat(50));

// 测试箭头操作符
debugTokens('me->query');

// 测试复合赋值操作符
debugTokens('sum += i');

// 测试减号和减法赋值
debugTokens('count -= 1');

// 测试包含操作符
debugTokens('#include <lib.h>');
