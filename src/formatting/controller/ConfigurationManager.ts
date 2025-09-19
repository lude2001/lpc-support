import * as vscode from 'vscode';
import { FormattingConfig } from '../config/FormattingConfig';
import { loadFormattingConfig, DEFAULT_FORMATTING_CONFIG } from '../config/DefaultConfig';

/**
 * 格式化配置管理器
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private currentConfig: FormattingConfig;
    private configChangeListeners: Array<(config: FormattingConfig) => void> = [];
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        this.currentConfig = this.loadConfiguration();
        this.setupConfigurationWatcher();
    }

    /**
     * 获取单例
     */
    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * 获取当前配置
     */
    getConfiguration(): FormattingConfig {
        return { ...this.currentConfig };
    }

    /**
     * 更新配置
     */
    async updateConfiguration(config: Partial<FormattingConfig>): Promise<void> {
        const vsCodeConfig = vscode.workspace.getConfiguration('lpc.formatting');
        
        for (const [key, value] of Object.entries(config)) {
            try {
                await vsCodeConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
            } catch (error) {
                console.error(`更新配置 ${key} 失败:`, error);
                throw new Error(`更新配置失败: ${key}`);
            }
        }
        
        // 重新加载配置
        this.reloadConfiguration();
    }

    /**
     * 重置为默认配置
     */
    async resetToDefaults(): Promise<void> {
        const vsCodeConfig = vscode.workspace.getConfiguration('lpc.formatting');
        
        // 获取所有配置项
        const inspect = vsCodeConfig.inspect('');
        const workspaceKeys = inspect?.workspaceValue ? Object.keys(inspect.workspaceValue) : [];
        const userKeys = inspect?.globalValue ? Object.keys(inspect.globalValue) : [];
        
        // 清除所有自定义配置
        for (const key of [...workspaceKeys, ...userKeys]) {
            try {
                await vsCodeConfig.update(key, undefined, vscode.ConfigurationTarget.Workspace);
                await vsCodeConfig.update(key, undefined, vscode.ConfigurationTarget.Global);
            } catch (error) {
                console.warn(`清除配置 ${key} 失败:`, error);
            }
        }
        
        this.reloadConfiguration();
    }

    /**
     * 获取配置模板
     */
    getConfigurationTemplates(): Array<{
        name: string;
        description: string;
        config: Partial<FormattingConfig>;
    }> {
        return [
            {
                name: '紧凑风格',
                description: '类似 C/C++ 的紧凑格式化风格',
                config: {
                    indentSize: 2,
                    useSpaces: true,
                    spaceAroundOperators: false,
                    spaceAfterComma: true,
                    spaceInsideBraces: false,
                    newlineBeforeOpenBrace: false,
                    functionCallStyle: 'compact',
                    functionDefStyle: 'compact',
                    controlStructureStyle: 'compact'
                }
            },
            {
                name: '宽松风格',
                description: '更宽松的格式化风格，易于阅读',
                config: {
                    indentSize: 4,
                    useSpaces: true,
                    spaceAroundOperators: true,
                    spaceAfterComma: true,
                    spaceInsideBraces: true,
                    newlineBeforeOpenBrace: true,
                    functionCallStyle: 'expanded',
                    functionDefStyle: 'expanded',
                    controlStructureStyle: 'expanded'
                }
            },
            {
                name: '经典 LPC',
                description: '经典 LPC 代码风格',
                config: {
                    indentSize: 4,
                    useSpaces: false, // 使用制表符
                    spaceAroundOperators: true,
                    spaceAfterComma: true,
                    spaceInsideBraces: true,
                    newlineBeforeOpenBrace: false,
                    functionCallStyle: 'compact',
                    functionDefStyle: 'expanded',
                    controlStructureStyle: 'compact'
                }
            },
            {
                name: 'FluffOS 推荐',
                description: 'FluffOS 官方推荐的代码风格',
                config: {
                    indentSize: 4,
                    useSpaces: true,
                    spaceAroundOperators: true,
                    spaceAfterComma: true,
                    spaceInsideBraces: true,
                    spaceInsideBrackets: false,
                    newlineBeforeOpenBrace: false,
                    newlineAfterOpenBrace: true,
                    alignParameters: true,
                    formatFunctionPointers: true,
                    formatMappings: true,
                    functionCallStyle: 'compact',
                    functionDefStyle: 'expanded'
                }
            }
        ];
    }

    /**
     * 应用配置模板
     */
    async applyTemplate(templateName: string): Promise<void> {
        const templates = this.getConfigurationTemplates();
        const template = templates.find(t => t.name === templateName);
        
        if (!template) {
            throw new Error(`未找到模板: ${templateName}`);
        }
        
        await this.updateConfiguration(template.config);
    }

    /**
     * 验证配置
     */
    validateConfiguration(config: Partial<FormattingConfig>): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // 验证缩进大小
        if (config.indentSize !== undefined) {
            if (config.indentSize < 1 || config.indentSize > 16) {
                errors.push('缩进大小必须在1-16之间');
            }
        }
        
        // 验证行长度
        if (config.maxLineLength !== undefined) {
            if (config.maxLineLength < 40 || config.maxLineLength > 300) {
                warnings.push('建议行长度设置在40-300之间');
            }
        }
        
        // 验证超时设置
        if (config.maxFormatTime !== undefined) {
            if (config.maxFormatTime < 1000 || config.maxFormatTime > 30000) {
                warnings.push('建议超时时间设置在1-30秒之间');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 添加配置变更监听器
     */
    onConfigurationChanged(listener: (config: FormattingConfig) => void): vscode.Disposable {
        this.configChangeListeners.push(listener);
        
        return new vscode.Disposable(() => {
            const index = this.configChangeListeners.indexOf(listener);
            if (index >= 0) {
                this.configChangeListeners.splice(index, 1);
            }
        });
    }

    /**
     * 获取配置项的详细信息
     */
    getConfigurationInspection(key: keyof FormattingConfig): {
        currentValue: any;
        defaultValue: any;
        workspaceValue?: any;
        userValue?: any;
        source: 'default' | 'user' | 'workspace';
    } {
        const vsCodeConfig = vscode.workspace.getConfiguration('lpc.formatting');
        const inspection = vsCodeConfig.inspect(key);
        
        let source: 'default' | 'user' | 'workspace' = 'default';
        if (inspection?.workspaceValue !== undefined) {
            source = 'workspace';
        } else if (inspection?.globalValue !== undefined) {
            source = 'user';
        }
        
        return {
            currentValue: this.currentConfig[key],
            defaultValue: DEFAULT_FORMATTING_CONFIG[key],
            workspaceValue: inspection?.workspaceValue,
            userValue: inspection?.globalValue,
            source
        };
    }

    /**
     * 导出配置
     */
    exportConfiguration(): string {
        return JSON.stringify(this.currentConfig, null, 2);
    }

    /**
     * 导入配置
     */
    async importConfiguration(configJson: string): Promise<void> {
        try {
            const config = JSON.parse(configJson) as Partial<FormattingConfig>;
            
            // 验证配置
            const validation = this.validateConfiguration(config);
            if (!validation.valid) {
                throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
            }
            
            await this.updateConfiguration(config);
            
            if (validation.warnings.length > 0) {
                vscode.window.showWarningMessage(
                    `配置导入成功，但有警告: ${validation.warnings.join(', ')}`
                );
            }
            
        } catch (error) {
            throw new Error(`导入配置失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 加载配置
     */
    private loadConfiguration(): FormattingConfig {
        try {
            return loadFormattingConfig();
        } catch (error) {
            console.error('加载格式化配置失败，使用默认配置:', error);
            return { ...DEFAULT_FORMATTING_CONFIG };
        }
    }

    /**
     * 重新加载配置
     */
    private reloadConfiguration(): void {
        const oldConfig = this.currentConfig;
        this.currentConfig = this.loadConfiguration();
        
        // 通知监听器
        this.notifyConfigurationChanged(oldConfig);
    }

    /**
     * 设置配置变更监听
     */
    private setupConfigurationWatcher(): void {
        const disposable = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('lpc.formatting')) {
                this.reloadConfiguration();
            }
        });
        
        this.disposables.push(disposable);
    }

    /**
     * 通知配置变更
     */
    private notifyConfigurationChanged(oldConfig: FormattingConfig): void {
        for (const listener of this.configChangeListeners) {
            try {
                listener(this.currentConfig);
            } catch (error) {
                console.error('配置变更监听器错误:', error);
            }
        }
    }

    /**
     * 销毁管理器
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.configChangeListeners = [];
    }
}