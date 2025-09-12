/**
 * 测试报告生成器
 * 生成详细的测试和质量报告
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TestResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    coverage?: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
}

export interface TestSuite {
    name: string;
    results: TestResult[];
    totalDuration: number;
    passRate: number;
    coverage?: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
}

export interface QualityMetrics {
    codeComplexity: {
        cyclomaticComplexity: number;
        maintainabilityIndex: number;
        technicalDebt: string;
    };
    testCoverage: {
        overall: number;
        critical: number;
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
    performance: {
        averageExecutionTime: number;
        memoryUsage: number;
        throughput: number;
    };
    reliability: {
        errorRate: number;
        crashRate: number;
        recoveryTime: number;
    };
}

export class TestReporter {
    private testSuites: TestSuite[] = [];
    private qualityMetrics?: QualityMetrics;
    private reportDir: string;

    constructor(reportDir: string = './coverage/reports') {
        this.reportDir = reportDir;
        this.ensureReportDirectory();
    }

    private ensureReportDirectory(): void {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    addTestSuite(suite: TestSuite): void {
        this.testSuites.push(suite);
    }

    setQualityMetrics(metrics: QualityMetrics): void {
        this.qualityMetrics = metrics;
    }

    generateHtmlReport(): string {
        const reportPath = path.join(this.reportDir, 'test-report.html');
        const htmlContent = this.generateHtmlContent();
        fs.writeFileSync(reportPath, htmlContent);
        return reportPath;
    }

    generateJsonReport(): string {
        const reportPath = path.join(this.reportDir, 'test-report.json');
        const jsonContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            testSuites: this.testSuites,
            qualityMetrics: this.qualityMetrics,
            summary: this.generateSummary()
        }, null, 2);
        fs.writeFileSync(reportPath, jsonContent);
        return reportPath;
    }

    generateMarkdownReport(): string {
        const reportPath = path.join(this.reportDir, 'test-report.md');
        const markdownContent = this.generateMarkdownContent();
        fs.writeFileSync(reportPath, markdownContent);
        return reportPath;
    }

    private generateSummary() {
        const totalTests = this.testSuites.reduce((sum, suite) => sum + suite.results.length, 0);
        const passedTests = this.testSuites.reduce((sum, suite) => 
            sum + suite.results.filter(r => r.status === 'passed').length, 0);
        const failedTests = this.testSuites.reduce((sum, suite) => 
            sum + suite.results.filter(r => r.status === 'failed').length, 0);
        const skippedTests = this.testSuites.reduce((sum, suite) => 
            sum + suite.results.filter(r => r.status === 'skipped').length, 0);
        const totalDuration = this.testSuites.reduce((sum, suite) => sum + suite.totalDuration, 0);

        return {
            totalTests,
            passedTests,
            failedTests,
            skippedTests,
            passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
            totalDuration,
            averageDuration: totalTests > 0 ? totalDuration / totalTests : 0
        };
    }

    private generateHtmlContent(): string {
        const summary = this.generateSummary();
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LPC Support 测试报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2196F3; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .subtitle { margin-top: 10px; opacity: 0.9; font-size: 1.2em; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2196F3; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .summary-card .label { color: #666; font-size: 0.9em; }
        .test-suites { margin-bottom: 40px; }
        .test-suite { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .test-suite-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #ddd; }
        .test-suite-header h3 { margin: 0; color: #333; }
        .test-suite-stats { margin-top: 10px; display: flex; gap: 20px; }
        .test-suite-stats span { font-size: 0.9em; color: #666; }
        .test-results { padding: 20px; }
        .test-result { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .test-result:last-child { border-bottom: none; }
        .test-name { flex: 1; }
        .test-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #4CAF50; color: white; }
        .status-failed { background: #F44336; color: white; }
        .status-skipped { background: #FF9800; color: white; }
        .test-duration { margin-left: 10px; color: #666; font-size: 0.9em; }
        .quality-metrics { margin-top: 40px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-section { background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .metric-section h4 { margin: 0 0 15px 0; color: #333; }
        .metric-item { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .metric-item:last-child { margin-bottom: 0; }
        .footer { background: #f8f9fa; padding: 20px 30px; border-radius: 0 0 8px 8px; color: #666; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>LPC Support 测试报告</h1>
            <div class="subtitle">FormattingVisitor.ts 重构 - 阶段4：优化和集成测试</div>
            <div class="subtitle">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="summary-card">
                    <h3>总测试数</h3>
                    <div class="value">${summary.totalTests}</div>
                    <div class="label">个测试用例</div>
                </div>
                <div class="summary-card">
                    <h3>通过率</h3>
                    <div class="value">${summary.passRate.toFixed(1)}%</div>
                    <div class="label">${summary.passedTests}/${summary.totalTests} 通过</div>
                </div>
                <div class="summary-card">
                    <h3>总耗时</h3>
                    <div class="value">${(summary.totalDuration / 1000).toFixed(2)}s</div>
                    <div class="label">平均 ${summary.averageDuration.toFixed(0)}ms/测试</div>
                </div>
                <div class="summary-card">
                    <h3>失败数</h3>
                    <div class="value" style="color: ${summary.failedTests > 0 ? '#F44336' : '#4CAF50'}">${summary.failedTests}</div>
                    <div class="label">${summary.skippedTests} 个跳过</div>
                </div>
            </div>

            <div class="test-suites">
                <h2>测试套件详情</h2>
                ${this.testSuites.map(suite => `
                    <div class="test-suite">
                        <div class="test-suite-header">
                            <h3>${suite.name}</h3>
                            <div class="test-suite-stats">
                                <span>通过率: ${suite.passRate.toFixed(1)}%</span>
                                <span>耗时: ${(suite.totalDuration / 1000).toFixed(2)}s</span>
                                <span>测试数: ${suite.results.length}</span>
                                ${suite.coverage ? `<span>覆盖率: ${suite.coverage.statements.toFixed(1)}%</span>` : ''}
                            </div>
                        </div>
                        <div class="test-results">
                            ${suite.results.map(result => `
                                <div class="test-result">
                                    <div class="test-name">${result.name}</div>
                                    <div>
                                        <span class="test-status status-${result.status}">${result.status}</span>
                                        <span class="test-duration">${result.duration.toFixed(0)}ms</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${this.qualityMetrics ? `
                <div class="quality-metrics">
                    <h2>质量指标</h2>
                    <div class="metrics-grid">
                        <div class="metric-section">
                            <h4>测试覆盖率</h4>
                            <div class="metric-item">
                                <span>总体覆盖率</span>
                                <strong>${this.qualityMetrics.testCoverage.overall.toFixed(1)}%</strong>
                            </div>
                            <div class="metric-item">
                                <span>语句覆盖率</span>
                                <strong>${this.qualityMetrics.testCoverage.statements.toFixed(1)}%</strong>
                            </div>
                            <div class="metric-item">
                                <span>分支覆盖率</span>
                                <strong>${this.qualityMetrics.testCoverage.branches.toFixed(1)}%</strong>
                            </div>
                            <div class="metric-item">
                                <span>函数覆盖率</span>
                                <strong>${this.qualityMetrics.testCoverage.functions.toFixed(1)}%</strong>
                            </div>
                        </div>
                        <div class="metric-section">
                            <h4>性能指标</h4>
                            <div class="metric-item">
                                <span>平均执行时间</span>
                                <strong>${this.qualityMetrics.performance.averageExecutionTime.toFixed(2)}ms</strong>
                            </div>
                            <div class="metric-item">
                                <span>内存使用</span>
                                <strong>${(this.qualityMetrics.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB</strong>
                            </div>
                            <div class="metric-item">
                                <span>吞吐量</span>
                                <strong>${this.qualityMetrics.performance.throughput.toFixed(0)} ops/s</strong>
                            </div>
                        </div>
                        <div class="metric-section">
                            <h4>代码质量</h4>
                            <div class="metric-item">
                                <span>循环复杂度</span>
                                <strong>${this.qualityMetrics.codeComplexity.cyclomaticComplexity}</strong>
                            </div>
                            <div class="metric-item">
                                <span>可维护性指数</span>
                                <strong>${this.qualityMetrics.codeComplexity.maintainabilityIndex}</strong>
                            </div>
                            <div class="metric-item">
                                <span>技术债务</span>
                                <strong>${this.qualityMetrics.codeComplexity.technicalDebt}</strong>
                            </div>
                        </div>
                        <div class="metric-section">
                            <h4>可靠性</h4>
                            <div class="metric-item">
                                <span>错误率</span>
                                <strong>${(this.qualityMetrics.reliability.errorRate * 100).toFixed(2)}%</strong>
                            </div>
                            <div class="metric-item">
                                <span>崩溃率</span>
                                <strong>${(this.qualityMetrics.reliability.crashRate * 100).toFixed(2)}%</strong>
                            </div>
                            <div class="metric-item">
                                <span>恢复时间</span>
                                <strong>${this.qualityMetrics.reliability.recoveryTime.toFixed(0)}ms</strong>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>由 LPC Support 测试质量保证系统自动生成</p>
        </div>
    </div>
</body>
</html>`;
    }

    private generateMarkdownContent(): string {
        const summary = this.generateSummary();
        
        return `# LPC Support 测试报告

## FormattingVisitor.ts 重构 - 阶段4：优化和集成测试

**生成时间**: ${new Date().toLocaleString('zh-CN')}

## 📊 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | ${summary.totalTests} |
| 通过数 | ${summary.passedTests} |
| 失败数 | ${summary.failedTests} |
| 跳过数 | ${summary.skippedTests} |
| 通过率 | ${summary.passRate.toFixed(1)}% |
| 总耗时 | ${(summary.totalDuration / 1000).toFixed(2)}s |
| 平均耗时 | ${summary.averageDuration.toFixed(0)}ms |

## 🧪 测试套件详情

${this.testSuites.map(suite => `
### ${suite.name}

- **通过率**: ${suite.passRate.toFixed(1)}%
- **耗时**: ${(suite.totalDuration / 1000).toFixed(2)}s
- **测试数**: ${suite.results.length}
${suite.coverage ? `- **覆盖率**: ${suite.coverage.statements.toFixed(1)}%` : ''}

#### 测试结果

| 测试名称 | 状态 | 耗时 |
|----------|------|------|
${suite.results.map(result => `| ${result.name} | ${result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️'} ${result.status} | ${result.duration.toFixed(0)}ms |`).join('\n')}

`).join('')}

${this.qualityMetrics ? `## 📈 质量指标

### 测试覆盖率
- **总体覆盖率**: ${this.qualityMetrics.testCoverage.overall.toFixed(1)}%
- **语句覆盖率**: ${this.qualityMetrics.testCoverage.statements.toFixed(1)}%
- **分支覆盖率**: ${this.qualityMetrics.testCoverage.branches.toFixed(1)}%
- **函数覆盖率**: ${this.qualityMetrics.testCoverage.functions.toFixed(1)}%

### 性能指标
- **平均执行时间**: ${this.qualityMetrics.performance.averageExecutionTime.toFixed(2)}ms
- **内存使用**: ${(this.qualityMetrics.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB
- **吞吐量**: ${this.qualityMetrics.performance.throughput.toFixed(0)} ops/s

### 代码质量
- **循环复杂度**: ${this.qualityMetrics.codeComplexity.cyclomaticComplexity}
- **可维护性指数**: ${this.qualityMetrics.codeComplexity.maintainabilityIndex}
- **技术债务**: ${this.qualityMetrics.codeComplexity.technicalDebt}

### 可靠性
- **错误率**: ${(this.qualityMetrics.reliability.errorRate * 100).toFixed(2)}%
- **崩溃率**: ${(this.qualityMetrics.reliability.crashRate * 100).toFixed(2)}%
- **恢复时间**: ${this.qualityMetrics.reliability.recoveryTime.toFixed(0)}ms

` : ''}## 🎯 结论和建议

### ✅ 测试通过情况
${summary.passRate >= 95 ? '✅ 测试通过率优秀 (≥95%)' : summary.passRate >= 85 ? '⚠️ 测试通过率良好 (85-95%)' : '❌ 测试通过率需要改进 (<85%)'}

### 📋 质量评估
${this.qualityMetrics ? `
${this.qualityMetrics.testCoverage.overall >= 90 ? '✅ 测试覆盖率优秀' : this.qualityMetrics.testCoverage.overall >= 80 ? '⚠️ 测试覆盖率良好' : '❌ 测试覆盖率需要改进'}
${this.qualityMetrics.performance.averageExecutionTime <= 100 ? '✅ 性能表现优秀' : this.qualityMetrics.performance.averageExecutionTime <= 500 ? '⚠️ 性能表现良好' : '❌ 性能需要优化'}
${this.qualityMetrics.reliability.errorRate <= 0.01 ? '✅ 可靠性优秀' : this.qualityMetrics.reliability.errorRate <= 0.05 ? '⚠️ 可靠性良好' : '❌ 可靠性需要改进'}
` : ''}

### 🚀 改进建议
${summary.failedTests > 0 ? `- ❗ 修复 ${summary.failedTests} 个失败的测试用例` : ''}
${this.qualityMetrics && this.qualityMetrics.testCoverage.overall < 90 ? `- 📊 提升测试覆盖率至90%以上（当前${this.qualityMetrics.testCoverage.overall.toFixed(1)}%）` : ''}
${this.qualityMetrics && this.qualityMetrics.performance.averageExecutionTime > 100 ? `- ⚡ 优化性能，减少平均执行时间` : ''}
${summary.skippedTests > 0 ? `- ⏭️ 完善 ${summary.skippedTests} 个跳过的测试用例` : ''}

---
*由 LPC Support 测试质量保证系统自动生成*`;
    }
}