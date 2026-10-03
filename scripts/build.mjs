import { build } from 'vite';
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'web'), path.join(dist, 'check'), { recursive: true });
await build({
  configFile: false,
  root: path.join(root, 'manual'),
  base: './',
  build: {
    outDir: dist, emptyOutDir: false,
    assetsInlineLimit: 4096, cssCodeSplit: false, target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});
await mkdir(path.join(dist, 'downloads'), { recursive: true });
await cp(path.join(root, 'skills/claude-environment-check/scripts/check.py'), path.join(dist, 'downloads/check.py'));
await cp(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE.txt'));
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(dist, 'THIRD_PARTY_NOTICES.md'));
await cp(path.join(root, 'licenses'), path.join(dist, 'licenses'), { recursive: true });
await cp(path.join(root, 'docs/隐私说明.md'), path.join(dist, 'privacy.md'));
execFileSync('python3', [path.join(root, 'scripts/package.py')], { stdio: 'inherit' });
await mkdir(path.join(dist, 'manual'), { recursive: true });
await writeFile(path.join(dist, 'manual/index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>前往完整手册</title><a href="../">阅读完整手册</a><script>location.replace('../' + location.search + location.hash)</script></html>`);
const index = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('Claude 防封指南')) throw new Error('Missing primary manual');
await writeFile(path.join(dist, '.nojekyll'), '');
console.log('静态站已构建：手册首页、辅助检测、本地检测脚本。');
