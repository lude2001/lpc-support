"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCConfigManager = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class LPCConfigManager {
    constructor(context) {
        this.configPath = path.join(context.globalStoragePath, LPCConfigManager.CONFIG_FILE);
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            console.error('Failed to load config:', error);
        }
        return { servers: [] };
    }
    saveConfig() {
        try {
            if (!fs.existsSync(path.dirname(this.configPath))) {
                fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Failed to save config:', error);
            vscode.window.showErrorMessage('保存配置文件失败');
        }
    }
    async addServer() {
        const name = await vscode.window.showInputBox({
            prompt: '输入服务器名称',
            placeHolder: '例如: 本地服务器'
        });
        if (!name)
            return;
        const url = await vscode.window.showInputBox({
            prompt: '输入服务器URL',
            placeHolder: 'http://127.0.0.1:8080'
        });
        if (!url)
            return;
        const description = await vscode.window.showInputBox({
            prompt: '输入服务器描述（可选）',
            placeHolder: '例如: 本地开发服务器'
        });
        const server = {
            name,
            url,
            description,
            active: this.config.servers.length === 0 // 如果是第一个服务器，设为活动
        };
        this.config.servers.push(server);
        if (server.active) {
            this.config.defaultServer = name;
        }
        this.saveConfig();
        vscode.window.showInformationMessage(`已添加服务器: ${name}`);
    }
    async selectServer() {
        const items = this.config.servers.map(server => ({
            label: server.name,
            description: server.description || '',
            detail: server.url,
            picked: server.active
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择活动服务器'
        });
        if (selected) {
            this.config.servers.forEach(server => {
                server.active = server.name === selected.label;
            });
            this.config.defaultServer = selected.label;
            this.saveConfig();
            vscode.window.showInformationMessage(`已切换到服务器: ${selected.label}`);
        }
    }
    getActiveServer() {
        return this.config.servers.find(server => server.active);
    }
    async removeServer() {
        const items = this.config.servers.map(server => ({
            label: server.name,
            description: server.description || '',
            detail: server.url
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要删除的服务器'
        });
        if (selected) {
            this.config.servers = this.config.servers.filter(server => server.name !== selected.label);
            if (this.config.defaultServer === selected.label) {
                this.config.defaultServer = this.config.servers[0]?.name;
                if (this.config.servers[0]) {
                    this.config.servers[0].active = true;
                }
            }
            this.saveConfig();
            vscode.window.showInformationMessage(`已删除服务器: ${selected.label}`);
        }
    }
    async showServerManager() {
        const items = [
            {
                label: "$(server) 管理服务器",
                description: "当前服务器数量: " + this.config.servers.length,
                detail: "管理FluffOS编译服务器",
                action: 'manage'
            },
            {
                label: "$(add) 添加新服务器",
                detail: "添加新的FluffOS编译服务器",
                action: 'add'
            },
            ...this.config.servers.map(server => ({
                label: `$(circle${server.active ? '-filled' : '-outline'}) ${server.name}`,
                description: server.description || '',
                detail: `${server.url}${server.active ? ' (当前活动)' : ''}`,
                action: 'select',
                server: server
            }))
        ];
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '管理FluffOS编译服务器',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selected) {
            switch (selected.action) {
                case 'add':
                    await this.addServer();
                    // 添加完成后重新显示管理器
                    await this.showServerManager();
                    break;
                case 'manage':
                    await this.manageServers();
                    break;
                case 'select':
                    if ('server' in selected) {
                        this.config.servers.forEach(s => {
                            s.active = s.name === selected.server.name;
                        });
                        this.config.defaultServer = selected.server.name;
                        this.saveConfig();
                        vscode.window.showInformationMessage(`已切换到服务器: ${selected.server.name}`);
                    }
                    break;
            }
        }
    }
    async manageServers() {
        const items = this.config.servers.map(server => ({
            label: `${server.name}${server.active ? ' (当前活动)' : ''}`,
            description: server.description || '',
            detail: server.url,
            server: server
        }));
        const selected = await vscode.window.showQuickPick([
            {
                label: "$(add) 添加新服务器",
                detail: "添加新的FluffOS编译服务器",
                action: 'add'
            },
            ...items.map(item => ({
                ...item,
                action: 'edit'
            }))
        ], {
            placeHolder: '选择要管理的服务器'
        });
        if (selected) {
            if (selected.action === 'add') {
                await this.addServer();
            }
            else if (selected.action === 'edit' && 'server' in selected) {
                await this.editServer(selected.server);
            }
            // 操作完成后重新显示管理器
            await this.showServerManager();
        }
    }
    async editServer(server) {
        const action = await vscode.window.showQuickPick([
            { label: "编辑服务器", value: 'edit' },
            { label: "删除服务器", value: 'delete' }
        ], {
            placeHolder: `选择操作: ${server.name}`
        });
        if (!action)
            return;
        if (action.value === 'delete') {
            const confirm = await vscode.window.showWarningMessage(`确定要删除服务器 "${server.name}" 吗？`, { modal: true }, '确定删除');
            if (confirm === '确定删除') {
                this.config.servers = this.config.servers.filter(s => s.name !== server.name);
                if (this.config.defaultServer === server.name) {
                    this.config.defaultServer = this.config.servers[0]?.name;
                    if (this.config.servers[0]) {
                        this.config.servers[0].active = true;
                    }
                }
                this.saveConfig();
                vscode.window.showInformationMessage(`已删除服务器: ${server.name}`);
            }
        }
        else {
            // 编辑服务器
            const newName = await vscode.window.showInputBox({
                prompt: '编辑服务器名称',
                value: server.name
            });
            if (!newName)
                return;
            const newUrl = await vscode.window.showInputBox({
                prompt: '编辑服务器URL',
                value: server.url
            });
            if (!newUrl)
                return;
            const newDescription = await vscode.window.showInputBox({
                prompt: '编辑服务器描述（可选）',
                value: server.description || ''
            });
            const index = this.config.servers.findIndex(s => s.name === server.name);
            if (index !== -1) {
                this.config.servers[index] = {
                    ...server,
                    name: newName,
                    url: newUrl,
                    description: newDescription
                };
                if (this.config.defaultServer === server.name) {
                    this.config.defaultServer = newName;
                }
                this.saveConfig();
                vscode.window.showInformationMessage(`已更新服务器: ${newName}`);
            }
        }
    }
}
exports.LPCConfigManager = LPCConfigManager;
LPCConfigManager.CONFIG_FILE = 'lpc-servers.json';
//# sourceMappingURL=config.js.map