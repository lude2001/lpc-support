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
            vscode.window.showErrorMessage(`加载配置文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
        return { servers: [] };
    }
    saveConfig() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            vscode.window.showErrorMessage(`保存配置文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    async getServerInput(server) {
        const name = await vscode.window.showInputBox({
            prompt: '输入服务器名称',
            placeHolder: '例如: 本地服务器',
            value: server?.name
        });
        if (!name)
            return;
        const url = await vscode.window.showInputBox({
            prompt: '输入服务器URL',
            placeHolder: 'http://127.0.0.1:8080',
            value: server?.url
        });
        if (!url)
            return;
        const description = await vscode.window.showInputBox({
            prompt: '输入服务器描述（可选）',
            placeHolder: '例如: 本地开发服务器',
            value: server?.description
        });
        return {
            name,
            url,
            description,
            active: server?.active ?? (this.config.servers.length === 0)
        };
    }
    updateActiveServer(serverName) {
        this.config.servers.forEach(server => {
            server.active = server.name === serverName;
        });
        this.config.defaultServer = serverName;
        this.saveConfig();
    }
    async addServer() {
        const server = await this.getServerInput();
        if (!server)
            return;
        this.config.servers.push(server);
        if (server.active) {
            this.config.defaultServer = server.name;
        }
        this.saveConfig();
        vscode.window.showInformationMessage(`已添加服务器: ${server.name}`);
    }
    async selectServer() {
        const items = this.getServerQuickPickItems();
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择活动服务器'
        });
        if (selected) {
            this.updateActiveServer(selected.label);
            vscode.window.showInformationMessage(`已切换到服务器: ${selected.label}`);
        }
    }
    getServerQuickPickItems() {
        return this.config.servers.map(server => ({
            label: server.name,
            description: server.description || '',
            detail: server.url,
            picked: server.active
        }));
    }
    getActiveServer() {
        return this.config.servers.find(server => server.active);
    }
    async removeServer() {
        const items = this.getServerQuickPickItems();
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要删除的服务器'
        });
        if (selected) {
            await this.deleteServer(selected.label);
        }
    }
    async deleteServer(serverName) {
        const confirm = await vscode.window.showWarningMessage(`确定要删除服务器 "${serverName}" 吗？`, { modal: true }, '确定删除');
        if (confirm === '确定删除') {
            this.config.servers = this.config.servers.filter(s => s.name !== serverName);
            if (this.config.defaultServer === serverName) {
                const firstServer = this.config.servers[0];
                if (firstServer) {
                    firstServer.active = true;
                    this.config.defaultServer = firstServer.name;
                }
                else {
                    this.config.defaultServer = undefined;
                }
            }
            this.saveConfig();
            vscode.window.showInformationMessage(`已删除服务器: ${serverName}`);
        }
    }
    async showServerManager() {
        const items = [
            {
                label: "$(server) 管理服务器",
                description: `当前服务器数量: ${this.config.servers.length}`,
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
                server
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
                    await this.showServerManager();
                    break;
                case 'manage':
                    await this.manageServers();
                    break;
                case 'select':
                    if ('server' in selected) {
                        this.updateActiveServer(selected.server.name);
                        vscode.window.showInformationMessage(`已切换到服务器: ${selected.server.name}`);
                    }
                    break;
            }
        }
    }
    async manageServers() {
        const items = [
            {
                label: "$(add) 添加新服务器",
                detail: "添加新的FluffOS编译服务器",
                action: 'add'
            },
            ...this.config.servers.map(server => ({
                label: `${server.name}${server.active ? ' (当前活动)' : ''}`,
                description: server.description || '',
                detail: server.url,
                action: 'edit',
                server
            }))
        ];
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要管理的服务器'
        });
        if (selected) {
            if (selected.action === 'add') {
                await this.addServer();
            }
            else if ('server' in selected) {
                const action = await vscode.window.showQuickPick([
                    { label: "编辑服务器", value: 'edit' },
                    { label: "删除服务器", value: 'delete' }
                ], {
                    placeHolder: `选择操作: ${selected.server.name}`
                });
                if (action?.value === 'delete') {
                    await this.deleteServer(selected.server.name);
                }
                else if (action?.value === 'edit') {
                    const updatedServer = await this.getServerInput(selected.server);
                    if (updatedServer) {
                        const index = this.config.servers.findIndex(s => s.name === selected.server.name);
                        if (index !== -1) {
                            this.config.servers[index] = updatedServer;
                            if (this.config.defaultServer === selected.server.name) {
                                this.config.defaultServer = updatedServer.name;
                            }
                            this.saveConfig();
                            vscode.window.showInformationMessage(`已更新服务器: ${updatedServer.name}`);
                        }
                    }
                }
            }
            await this.showServerManager();
        }
    }
}
LPCConfigManager.CONFIG_FILE = 'lpc-servers.json';
exports.LPCConfigManager = LPCConfigManager;
//# sourceMappingURL=config.js.map