import { studyBuildHash } from './scripts/study-build-hash.mjs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	define: { 'import.meta.env.VITE_STUDY_BUILD_HASH': JSON.stringify(studyBuildHash(new URL('.', import.meta.url))) },
	plugins: [sveltekit()]
});
