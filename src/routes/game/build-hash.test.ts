import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error Node declarations are excluded from the browser tsconfig.
import { execFileSync } from 'node:child_process';
import { studyBuildHash } from '../../../scripts/study-build-hash.mjs';
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it.each(['missing git', 'missing .git'])('uses unknown build hash for %s', reason => {
	vi.stubEnv('VITE_STUDY_BUILD_HASH', undefined);
	vi.mocked(execFileSync).mockImplementation(() => { throw new Error(reason); });
	expect(studyBuildHash(new URL('file:///tmp/source/'))).toBe('unknown');
});
it('decodes checkout paths with spaces and retains the environment override', () => {
	vi.stubEnv('VITE_STUDY_BUILD_HASH', undefined);
	vi.mocked(execFileSync).mockReturnValue('abc123\n');
	expect(studyBuildHash(new URL('file:///tmp/source%20archive/'))).toBe('abc123');
	expect(vi.mocked(execFileSync).mock.calls[0][1]).toEqual(['-C', '/tmp/source archive/', 'rev-parse', 'HEAD']);
	vi.stubEnv('VITE_STUDY_BUILD_HASH', 'release-build');
	expect(studyBuildHash(new URL('file:///tmp/source/'))).toBe('release-build');
	expect(execFileSync).toHaveBeenCalledTimes(1);
});
