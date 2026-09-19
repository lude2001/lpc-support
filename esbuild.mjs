import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// 复制文件的辅助函数
function copyFile(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

// 复制模板文件插件
const copyTemplatesPlugin = {
  name: 'copy-templates',
  setup(build) {
    build.onEnd(() => {
      try {
        // 复制模板文件到dist目录
        copyFile('src/templates/functionDocPanel.html', 'dist/templates/functionDocPanel.html');
        copyFile('src/templates/functionDocPanel.js', 'dist/templates/functionDocPanel.js');
        copyFile('src/templates/functionDocPanel.css', 'dist/templates/functionDocPanel.css');
        console.log('✅ Template files copied successfully');
      } catch (error) {
        console.error('❌ Failed to copy template files:', error);
        throw error;
      }
    });
  }
};

const extensionBuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
  treeShaking: true,
  loader: {
    '.ts': 'ts'
  },
  conditions: ['node'],
  mainFields: ['main', 'module'],
  keepNames: false,
  metafile: true,
  external: [
    'vscode'
    // 只排除 VS Code API，其他依赖都要打包进bundle（如 axios）
  ]
};

build({
  ...extensionBuildOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  plugins: [copyTemplatesPlugin]
}).then(result => {
  const metafile = result.metafile;
  if (metafile) {
    console.log('📦 Bundle analysis:');
    const outputs = Object.entries(metafile.outputs);
    outputs.forEach(([path, info]) => {
      console.log(`${path}: ${(info.bytes / 1024).toFixed(1)}KB`);
    });
  }
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
