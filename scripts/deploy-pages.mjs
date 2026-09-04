// Deploys dist/ to Cloudflare Pages. Project name derives from PROJECT_SHORT_TITLE (kebab-case);
// pass a branch to create a preview (e.g. `node scripts/deploy-pages.mjs qa`), default `main`.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const projectSource = readFileSync(new URL('../src/config/project.ts', import.meta.url), 'utf8');
const shortTitle = /PROJECT_SHORT_TITLE = '([^']+)'/.exec(projectSource)?.[1];
if (!shortTitle) throw new Error('PROJECT_SHORT_TITLE not found in src/config/project.ts');
const projectName = shortTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const branch = process.argv[2] ?? 'main';
if (!existsSync('dist/sw.js')) throw new Error('dist/ is missing or incomplete; run `pnpm build` first');

const commitDirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
const message = `${execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()}${commitDirty ? '-dirty' : ''}`;
const args = ['wrangler@4', 'pages', 'deploy', 'dist', `--project-name=${projectName}`, `--branch=${branch}`, `--commit-dirty=${commitDirty}`, `--commit-message=${message}`];
console.log(`deploying to Pages project "${projectName}" branch "${branch}"`);
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
