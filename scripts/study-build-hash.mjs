// @ts-expect-error Node declarations are excluded from the browser tsconfig.
import { execFileSync } from 'node:child_process';
// @ts-expect-error Node declarations are excluded from the browser tsconfig.
import { fileURLToPath } from 'node:url';

/** @param {URL} root */
export function studyBuildHash(root) {
	if (process.env.VITE_STUDY_BUILD_HASH !== undefined) return process.env.VITE_STUDY_BUILD_HASH;
	try {
		return execFileSync('git', ['-C', fileURLToPath(root), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return 'unknown';
	}
}
