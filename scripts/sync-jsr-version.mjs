// Keeps jsr.json version in sync with package.json.
// Runs automatically via the npm `version` lifecycle hook.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const jsr = JSON.parse(readFileSync('./jsr.json', 'utf8'));

jsr.version = pkg.version;

writeFileSync('./jsr.json', `${JSON.stringify(jsr, null, 2)}\n`);
