/**
 * Fail the build/deploy if dist contains files scanners commonly exploit
 * or that should never be published (secrets, backups, source maps, etc.).
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

const FORBIDDEN_NAMES = new Set([
  '.env',
  '.git',
  'database.sql',
  'backup.zip',
  'config.old',
  'config.bak',
  'phpinfo.php',
]);

const FORBIDDEN_EXT = /\.(env|map|bak|old|sql|zip|tar|gz|tgz|php|log|pem|key)$/i;
const FORBIDDEN_PATH = /(^|\/)(\.git|node_modules|admin_old|test|staging|debug|swagger)(\/|$)/i;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (!fs.existsSync(distDir)) {
  console.error('verifyDistSecurity: dist/ not found — run build first');
  process.exit(1);
}

const violations = [];
const files = walk(distDir);

for (const file of files) {
  const rel = path.relative(distDir, file).replace(/\\/g, '/');
  const base = path.basename(file);

  if (FORBIDDEN_NAMES.has(base)) violations.push(rel);
  if (FORBIDDEN_EXT.test(base)) violations.push(rel);
  if (FORBIDDEN_PATH.test(rel)) violations.push(rel);
  if (base.startsWith('.env')) violations.push(rel);
}

const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  const html = fs.readFileSync(indexHtml, 'utf8');
  if (html.includes('src/main.tsx')) {
    violations.push('index.html references dev entry src/main.tsx');
  }
}

const mapFiles = files.filter((f) => f.endsWith('.map'));
if (mapFiles.length > 0) {
  for (const f of mapFiles) {
    violations.push(path.relative(distDir, f).replace(/\\/g, '/'));
  }
}

if (violations.length > 0) {
  console.error('verifyDistSecurity: forbidden files in dist/:');
  for (const v of [...new Set(violations)].sort()) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`verifyDistSecurity: OK (${files.length} files, no leaks detected)`);
