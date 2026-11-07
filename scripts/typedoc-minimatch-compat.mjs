// TypeDoc 0.28 calls `Minimatch#matchOne` to prune directories while expanding
// entry points, but minimatch >= 11.0.1 (the first release that fixes
// GHSA-g3hv-75wg-m249) made it private. This preload restores a permissive
// version: every directory is walked, and the real `match()` still decides
// which files become entry points, so the result is identical.
//
// Delete this file (and its use in generate-api-docs.mjs) once TypeDoc
// supports minimatch 11 natively.
import { Minimatch } from 'minimatch';

if (typeof Minimatch.prototype.matchOne !== 'function') {
  Minimatch.prototype.matchOne = () => true;
}
