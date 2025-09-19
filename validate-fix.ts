#!/usr/bin/env node

import { StandaloneFormattingEngine } from './standalone-formatter';
import * as fs from 'fs';

async function validateFix() {
    const engine = new StandaloneFormattingEngine();

    const testCode = `// 测试修复的问题案例
inherit"/std/object";

void test_function() {
    string *arr=({"item1","item2","item3"});
    function calc=(:$1+$2:);
    if(x>0)write("positive");else write("non-positive");
    mapping data=(["key1":"value1","key2":"value2"]);
}`;

    console.log('🔍 修复验证测试');
    console.log('=====================================');
    console.log('📝 格式化前:');
    console.log(testCode);
    console.log('\n=====================================');

    const result = await engine.formatText(testCode);

    console.log('📝 格式化后:');
    console.log(result.formattedText);
    console.log('=====================================');
    console.log(`✅ 格式化状态: ${result.success ? '成功' : '失败'}`);

    if (result.errors && result.errors.length > 0) {
        console.log(`❌ 错误: ${result.errors.join(', ')}`);
    }

    if (result.warnings && result.warnings.length > 0) {
        console.log(`⚠️  警告: ${result.warnings.join(', ')}`);
    }
}

validateFix().catch(console.error);