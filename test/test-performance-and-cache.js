/**
 * 测试 LPC 格式化程序的性能和缓存机制
 * 评估格式化速度、内存使用和缓存有效性
 */

const fs = require('fs');
const path = require('path');

function testPerformanceAndCache() {
    console.log('LPC 格式化程序性能和缓存测试');
    console.log('================================\n');

    const testFile = path.join(__dirname, 'yifeng-jian.c');
    
    if (!fs.existsSync(testFile)) {
        console.error('测试文件不存在:', testFile);
        return;
    }

    const content = fs.readFileSync(testFile, 'utf8');
    const fileSize = content.length;
    const lines = content.split('\n');

    console.log('文件基本信息:');
    console.log(`- 文件大小: ${fileSize} 字节`);
    console.log(`- 行数: ${lines.length}`);
    console.log(`- 平均行长度: ${(fileSize / lines.length).toFixed(1)} 字符/行\n`);

    // 测试 1: 基本性能基准
    console.log('测试 1: 基本性能基准');
    console.log('-'.repeat(25));
    
    const performanceResults = runPerformanceBenchmark(content);
    displayPerformanceResults(performanceResults);
    console.log('');

    // 测试 2: 缓存机制评估
    console.log('测试 2: 缓存机制评估');
    console.log('-'.repeat(24));
    
    const cacheResults = testCacheMechanism(content);
    displayCacheResults(cacheResults);
    console.log('');

    // 测试 3: 内存使用分析
    console.log('测试 3: 内存使用分析');
    console.log('-'.repeat(22));
    
    const memoryResults = analyzeMemoryUsage(content);
    displayMemoryResults(memoryResults);
    console.log('');

    // 测试 4: 缩放性测试
    console.log('测试 4: 缩放性测试');
    console.log('-'.repeat(20));
    
    const scalabilityResults = testScalability(content);
    displayScalabilityResults(scalabilityResults);
    console.log('');

    // 测试 5: 配置影响分析
    console.log('测试 5: 配置对性能的影响');
    console.log('-'.repeat(26));
    
    const configResults = testConfigurationImpact(content);
    displayConfigurationResults(configResults);
    console.log('');

    // 性能建议
    console.log('性能优化建议');
    console.log('============');
    generatePerformanceRecommendations(performanceResults, cacheResults, memoryResults);
}

function runPerformanceBenchmark(content) {
    const results = {};
    
    console.log('执行基准测试...');
    
    // 模拟解析时间
    const parseStart = process.hrtime.bigint();
    simulateParsingProcess(content);
    const parseEnd = process.hrtime.bigint();
    results.parseTime = Number(parseEnd - parseStart) / 1000000; // 转换为毫秒
    
    // 模拟格式化时间
    const formatStart = process.hrtime.bigint();
    simulateFormattingProcess(content);
    const formatEnd = process.hrtime.bigint();
    results.formatTime = Number(formatEnd - formatStart) / 1000000; // 转换为毫秒
    
    // 总时间
    results.totalTime = results.parseTime + results.formatTime;
    
    // 计算吞吐量
    results.throughput = {
        charactersPerSecond: (content.length / results.totalTime) * 1000,
        linesPerSecond: (content.split('\n').length / results.totalTime) * 1000
    };
    
    return results;
}

function simulateParsingProcess(content) {
    // 模拟 ANTLR 解析的复杂度
    let complexity = 0;
    const lines = content.split('\n');
    
    lines.forEach(line => {
        // 模拟词法分析
        for (let i = 0; i < line.length; i += 10) {
            complexity += Math.sqrt(i + 1);
        }
        
        // 模拟语法分析复杂度
        if (line.includes('{') || line.includes('}')) {
            complexity += 100;
        }
        if (line.includes('([') || line.includes('])')) {
            complexity += 50;
        }
        if (line.includes('"')) {
            complexity += 20;
        }
    });
    
    return complexity;
}

function simulateFormattingProcess(content) {
    // 模拟格式化访问者的工作量
    let operations = 0;
    const lines = content.split('\n');
    
    lines.forEach(line => {
        // 模拟缩进计算
        operations += 5;
        
        // 模拟空格调整
        const spaceOperations = (line.match(/\s/g) || []).length;
        operations += spaceOperations * 2;
        
        // 模拟复杂表达式处理
        const operators = (line.match(/[=<>!+\-*/&|]/g) || []).length;
        operations += operators * 10;
        
        // 模拟 mapping 处理
        if (line.includes('([') || line.includes('])')) {
            operations += 100;
        }
    });
    
    // 添加一些实际的计算负载来模拟处理时间
    for (let i = 0; i < operations / 1000; i++) {
        Math.sqrt(Math.random() * 1000);
    }
    
    return operations;
}

function testCacheMechanism(content) {
    console.log('测试缓存机制...');
    
    const results = {
        firstRun: 0,
        cachedRun: 0,
        hitRate: 0,
        memoryUsage: 0,
        evictionTest: {}
    };
    
    // 模拟缓存类
    const mockCache = new MockFormattingCache();
    
    // 第一次运行（无缓存）
    const firstStart = process.hrtime.bigint();
    const key = mockCache.generateKey(content);
    const cachedResult = mockCache.get(content, { indentSize: 4 });
    if (!cachedResult) {
        simulateFormattingProcess(content);
        mockCache.set(content, { indentSize: 4 }, 'formatted_content');
    }
    const firstEnd = process.hrtime.bigint();
    results.firstRun = Number(firstEnd - firstStart) / 1000000;
    
    // 第二次运行（有缓存）
    const cachedStart = process.hrtime.bigint();
    const cachedResult2 = mockCache.get(content, { indentSize: 4 });
    const cachedEnd = process.hrtime.bigint();
    results.cachedRun = Number(cachedEnd - cachedStart) / 1000000;
    
    // 计算命中率
    results.hitRate = cachedResult2 ? 100 : 0;
    
    // 测试内存使用
    results.memoryUsage = mockCache.getMemoryUsage();
    
    // 测试缓存驱逐
    results.evictionTest = testCacheEviction(mockCache, content);
    
    return results;
}

function testCacheEviction(mockCache, baseContent) {
    const evictionResults = {
        maxEntriesTest: false,
        memoryLimitTest: false,
        ageEvictionTest: false
    };
    
    // 测试最大条目数限制
    for (let i = 0; i < 60; i++) { // 超过默认的 50 个限制
        const testContent = baseContent + `\n// test content ${i}`;
        mockCache.set(testContent, { indentSize: 4 }, `formatted_${i}`);
    }
    
    evictionResults.maxEntriesTest = mockCache.getSize() <= 50;
    
    // 测试内存限制（模拟大文件）
    const largeContent = baseContent.repeat(100);
    mockCache.set(largeContent, { indentSize: 4 }, 'large_formatted');
    evictionResults.memoryLimitTest = mockCache.getMemoryUsage() < 5 * 1024 * 1024;
    
    return evictionResults;
}

function analyzeMemoryUsage(content) {
    console.log('分析内存使用...');
    
    const results = {
        baselineMemory: process.memoryUsage().heapUsed,
        peakMemory: 0,
        finalMemory: 0,
        memoryEfficiency: 0
    };
    
    const baseline = process.memoryUsage().heapUsed;
    
    // 模拟内存密集型操作
    let largeArrays = [];
    for (let i = 0; i < 10; i++) {
        // 模拟创建 AST 节点
        const astNodes = content.split('\n').map((line, index) => ({
            type: 'statement',
            line: index,
            content: line,
            children: line.length > 50 ? new Array(10).fill(null) : []
        }));
        largeArrays.push(astNodes);
        
        const currentMemory = process.memoryUsage().heapUsed;
        results.peakMemory = Math.max(results.peakMemory, currentMemory);
    }
    
    // 清理
    largeArrays = null;
    if (global.gc) {
        global.gc();
    }
    
    results.finalMemory = process.memoryUsage().heapUsed;
    results.memoryEfficiency = (results.peakMemory - baseline) / content.length;
    
    return results;
}

function testScalability(baseContent) {
    console.log('测试缩放性...');
    
    const results = {
        smallFile: { size: 0, time: 0 },
        mediumFile: { size: 0, time: 0 },
        largeFile: { size: 0, time: 0 },
        scalingFactor: 0
    };
    
    // 小文件 (原始大小)
    const smallContent = baseContent;
    results.smallFile.size = smallContent.length;
    const smallStart = process.hrtime.bigint();
    simulateFormattingProcess(smallContent);
    const smallEnd = process.hrtime.bigint();
    results.smallFile.time = Number(smallEnd - smallStart) / 1000000;
    
    // 中等文件 (2x)
    const mediumContent = baseContent + '\n' + baseContent;
    results.mediumFile.size = mediumContent.length;
    const mediumStart = process.hrtime.bigint();
    simulateFormattingProcess(mediumContent);
    const mediumEnd = process.hrtime.bigint();
    results.mediumFile.time = Number(mediumEnd - mediumStart) / 1000000;
    
    // 大文件 (4x)
    const largeContent = [baseContent, baseContent, baseContent, baseContent].join('\n');
    results.largeFile.size = largeContent.length;
    const largeStart = process.hrtime.bigint();
    simulateFormattingProcess(largeContent);
    const largeEnd = process.hrtime.bigint();
    results.largeFile.time = Number(largeEnd - largeStart) / 1000000;
    
    // 计算缩放因子
    const sizeRatio = results.largeFile.size / results.smallFile.size;
    const timeRatio = results.largeFile.time / results.smallFile.time;
    results.scalingFactor = timeRatio / sizeRatio; // 理想情况下应该接近 1.0
    
    return results;
}

function testConfigurationImpact(content) {
    console.log('测试不同配置的性能影响...');
    
    const configurations = [
        { name: 'minimal', config: { indentSize: 4, insertSpaces: true } },
        { name: 'standard', config: { 
            indentSize: 4, 
            insertSpaces: true, 
            spaceAroundOperators: true,
            bracesOnNewLine: false 
        }},
        { name: 'expanded', config: { 
            indentSize: 8, 
            insertSpaces: true, 
            spaceAroundOperators: true,
            bracesOnNewLine: true,
            mappingLiteralFormat: 'expanded'
        }}
    ];
    
    const results = {};
    
    configurations.forEach(({ name, config }) => {
        const start = process.hrtime.bigint();
        
        // 模拟配置影响的额外处理
        let additionalOps = 0;
        if (config.spaceAroundOperators) additionalOps += 100;
        if (config.bracesOnNewLine) additionalOps += 50;
        if (config.mappingLiteralFormat === 'expanded') additionalOps += 200;
        
        simulateFormattingProcess(content);
        for (let i = 0; i < additionalOps; i++) {
            Math.sqrt(i);
        }
        
        const end = process.hrtime.bigint();
        results[name] = {
            time: Number(end - start) / 1000000,
            config: config
        };
    });
    
    return results;
}

function displayPerformanceResults(results) {
    console.log(`解析时间: ${results.parseTime.toFixed(2)} ms`);
    console.log(`格式化时间: ${results.formatTime.toFixed(2)} ms`);
    console.log(`总时间: ${results.totalTime.toFixed(2)} ms`);
    console.log(`吞吐量:`);
    console.log(`  - ${Math.round(results.throughput.charactersPerSecond)} 字符/秒`);
    console.log(`  - ${Math.round(results.throughput.linesPerSecond)} 行/秒`);
    
    // 性能评级
    const rating = results.totalTime < 100 ? '优秀' : 
                  results.totalTime < 500 ? '良好' : 
                  results.totalTime < 1000 ? '一般' : '需要优化';
    console.log(`性能评级: ${rating}`);
}

function displayCacheResults(results) {
    console.log(`首次运行时间: ${results.firstRun.toFixed(2)} ms`);
    console.log(`缓存运行时间: ${results.cachedRun.toFixed(2)} ms`);
    console.log(`缓存命中率: ${results.hitRate}%`);
    console.log(`缓存内存使用: ${results.memoryUsage} 字节`);
    
    const speedup = results.firstRun / results.cachedRun;
    console.log(`缓存加速比: ${speedup.toFixed(1)}x`);
    
    console.log('缓存驱逐测试:');
    console.log(`  - 最大条目限制: ${results.evictionTest.maxEntriesTest ? '通过' : '失败'}`);
    console.log(`  - 内存限制: ${results.evictionTest.memoryLimitTest ? '通过' : '失败'}`);
}

function displayMemoryResults(results) {
    const baseline = results.baselineMemory / 1024 / 1024;
    const peak = results.peakMemory / 1024 / 1024;
    const final = results.finalMemory / 1024 / 1024;
    
    console.log(`基准内存使用: ${baseline.toFixed(2)} MB`);
    console.log(`峰值内存使用: ${peak.toFixed(2)} MB`);
    console.log(`最终内存使用: ${final.toFixed(2)} MB`);
    console.log(`内存效率: ${results.memoryEfficiency.toFixed(2)} 字节/字符`);
    
    const memoryIncrease = ((peak - baseline) / baseline) * 100;
    console.log(`内存增长: ${memoryIncrease.toFixed(1)}%`);
}

function displayScalabilityResults(results) {
    console.log(`小文件 (${results.smallFile.size} 字节): ${results.smallFile.time.toFixed(2)} ms`);
    console.log(`中等文件 (${results.mediumFile.size} 字节): ${results.mediumFile.time.toFixed(2)} ms`);
    console.log(`大文件 (${results.largeFile.size} 字节): ${results.largeFile.time.toFixed(2)} ms`);
    console.log(`缩放因子: ${results.scalingFactor.toFixed(2)} (越接近1.0越好)`);
    
    const scalingRating = results.scalingFactor < 1.2 ? '线性' :
                         results.scalingFactor < 2.0 ? '良好' :
                         results.scalingFactor < 3.0 ? '一般' : '较差';
    console.log(`缩放性评级: ${scalingRating}`);
}

function displayConfigurationResults(results) {
    Object.entries(results).forEach(([name, result]) => {
        console.log(`${name} 配置: ${result.time.toFixed(2)} ms`);
    });
    
    const baseline = results.minimal.time;
    console.log('\n相对于最小配置的开销:');
    Object.entries(results).forEach(([name, result]) => {
        if (name !== 'minimal') {
            const overhead = ((result.time - baseline) / baseline) * 100;
            console.log(`  ${name}: +${overhead.toFixed(1)}%`);
        }
    });
}

function generatePerformanceRecommendations(perf, cache, memory) {
    console.log('基于测试结果的建议:');
    
    if (perf.totalTime > 500) {
        console.log('- 考虑实现增量格式化以提高大文件性能');
    }
    
    if (cache.hitRate < 80) {
        console.log('- 优化缓存键生成算法以提高命中率');
    }
    
    if (memory.memoryEfficiency > 100) {
        console.log('- 优化内存使用，减少 AST 节点开销');
    }
    
    console.log('- 考虑添加异步格式化支持');
    console.log('- 实现格式化优先级队列');
    console.log('- 添加格式化进度指示器');
}

// 模拟缓存类
class MockFormattingCache {
    constructor() {
        this.cache = new Map();
        this.memoryUsage = 0;
        this.maxSize = 50;
    }
    
    generateKey(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
    
    get(text, options) {
        const key = this.generateKey(text);
        const entry = this.cache.get(key);
        return entry ? entry.result : null;
    }
    
    set(text, options, result) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            const removed = this.cache.get(firstKey);
            this.cache.delete(firstKey);
            this.memoryUsage -= removed.size;
        }
        
        const key = this.generateKey(text);
        const size = text.length + result.length;
        this.cache.set(key, { result, size, timestamp: Date.now() });
        this.memoryUsage += size;
    }
    
    getSize() {
        return this.cache.size;
    }
    
    getMemoryUsage() {
        return this.memoryUsage;
    }
}

// 运行测试
testPerformanceAndCache();