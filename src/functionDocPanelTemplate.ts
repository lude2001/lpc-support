import * as fs from 'fs';
import * as path from 'path';
import type { FunctionDocPanelInitialData } from './functionDocPanelViewModel';

interface FunctionDocPanelTemplate {
    html: string;
    script: string;
}

export function renderFunctionDocPanelHtml(
    baseDir: string,
    initialData: FunctionDocPanelInitialData
): string {
    const template = loadFunctionDocPanelTemplate(baseDir);
    if (!template) {
        return getFallbackContent();
    }

    const scriptTag = `
            <script>
                window.initialData = ${JSON.stringify(initialData)};

                ${template.script}

                (function() {
                    function tryRender() {
                        if (window.functionDocPanel && window.initialData) {
                            window.functionDocPanel.renderFunctionList(
                                window.initialData.currentFunctions,
                                window.initialData.inheritedFunctionGroups
                            );
                        } else {
                            setTimeout(tryRender, 10);
                        }
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', tryRender);
                    } else {
                        tryRender();
                    }
                })();
            </script>
        `;

    return template.html.replace('</body>', `${scriptTag}</body>`);
}

function loadFunctionDocPanelTemplate(baseDir: string): FunctionDocPanelTemplate | undefined {
    let htmlPath = path.join(baseDir, 'templates', 'functionDocPanel.html');
    let jsPath = path.join(baseDir, 'templates', 'functionDocPanel.js');

    if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(baseDir, '..', 'src', 'templates', 'functionDocPanel.html');
    }
    if (!fs.existsSync(jsPath)) {
        jsPath = path.join(baseDir, '..', 'src', 'templates', 'functionDocPanel.js');
    }

    try {
        return {
            html: fs.readFileSync(htmlPath, 'utf8'),
            script: fs.readFileSync(jsPath, 'utf8')
        };
    } catch (error) {
        console.error('Failed to read template files:', error);
        return undefined;
    }
}

function getFallbackContent(): string {
    return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LPC 函数文档</title>
        </head>
        <body>
            <div style="padding: 20px; text-align: center;">
                <h3>模板文件加载失败</h3>
                <p>无法加载函数文档面板模板文件。</p>
            </div>
        </body>
        </html>`;
}
