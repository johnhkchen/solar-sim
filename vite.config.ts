import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'tools/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	},
	server: {
		host: '0.0.0.0', // Bind to all network interfaces (enables Tailscale access)
		port: 5173
	}
});
