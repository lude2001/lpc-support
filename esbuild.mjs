import { build } from 'esbuild';

build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node16',
  external: [
    'vscode'
    // 只排除 VS Code API，其他依赖都要打包进bundle
    // antlr4ts, axios, cheerio 必须被打包，否则运行时找不到
  ],
  format: 'cjs',
  sourcemap: process.env.NODE_ENV === 'development' ? true : 'external',
  minify: process.env.NODE_ENV === 'production',
  treeShaking: true,
  loader: {
    '.ts': 'ts'
  },
  conditions: ['node'],
  mainFields: ['main', 'module'],
  keepNames: false,
  metafile: true
}).then(result => {
  if (result.metafile) {
    console.log('📦 Bundle analysis:');
    const outputs = Object.entries(result.metafile.outputs);
    outputs.forEach(([path, info]) => {
      console.log(`${path}: ${(info.bytes / 1024).toFixed(1)}KB`);
    });
  }
}).catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});