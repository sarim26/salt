/**
 * Block secrets/backups from public/ before they get copied into dist/.
 */
import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve('public');
const FORBIDDEN_EXT = /\.(env|bak|old|sql|zip|tar|gz|tgz|php|log|pem|key|map)$/i;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(publicDir)) {
  const rel = path.relative(publicDir, file).replace(/\\/g, '/');
  const base = path.basename(file);
  if (base.startsWith('.env')) violations.push(rel);
  if (FORBIDDEN_EXT.test(base)) violations.push(rel);
}

if (violations.length > 0) {
  console.error('verifyPublicFolder: do not publish these files from public/:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('verifyPublicFolder: OK');
