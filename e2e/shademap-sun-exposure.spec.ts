import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for ShadeMap sun exposure integration.
 *
 * These tests verify that the ShadeMap sun exposure mode works correctly
 * in a real browser environment with actual WebGL rendering.
 */

// The full URL with coordinates for San Francisco
const RESULTS_URL = '/results?lat=37.73331362888408&lon=-122.44963312250731&tz=America%2FLos_Angeles#analysis';

test.describe('ShadeMap Sun Exposure', () => {
	// Increase timeout for this test suite - sun exposure calculation takes time
	test.setTimeout(120000);

	// Single comprehensive test that captures all debug info
	test('debug sun exposure flow', async ({ page }) => {
		const logs: string[] = [];

		// Capture all console logs
		page.on('console', msg => {
			const text = msg.text();
			logs.push(`[${msg.type()}] ${text}`);
		});

		// Also capture page errors
		page.on('pageerror', error => {
			logs.push(`[PAGE ERROR] ${error.message}`);
		});

		// Navigate to results page with coordinates
		await page.goto(RESULTS_URL);

		// Wait for map container
		await page.waitForSelector('.leaflet-container', { timeout: 15000 });

		// Wait for ShadeMap and sun exposure flow to complete
		// This needs to be long enough for:
		// 1. Map to initialize
		// 2. Terrain tiles to load
		// 3. HeightMap to be created
		// 4. Sun exposure to be enabled
		await page.waitForTimeout(30000);

		// Wait for "tileloaded" events which indicate sun exposure iteration progress
		// The updateDateRange function emits "tileloaded" for each iteration
		await page.waitForTimeout(5000); // Extra wait for iterations to complete

		// Output all captured logs for analysis
		console.log('\n========== CAPTURED BROWSER LOGS ==========\n');

		// Filter and categorize logs
		const shadeMapLogs = logs.filter(l =>
			l.includes('ShadeMap') ||
			l.includes('heightMap') ||
			l.includes('getHoursOfSun') ||
			l.includes('kernel') ||
			l.includes('sunExposure') ||
			l.includes('tileloaded') ||
			l.includes('iteration')
		);

		shadeMapLogs.forEach(log => console.log(log));

		console.log('\n========== KEY FINDINGS ==========\n');

		// Check for sun exposure completion - look for signs that the flow ran
		const sunExposureIterationsRan = logs.some(l =>
			l.includes('setSunExposure') || l.includes('sun exposure')
		);

		console.log(`sunExposureIterationsRan: ${sunExposureIterationsRan}`);

		// Extract pixel values
		const pixelLog = logs.find(l => l.includes('pixel=R'));
		if (pixelLog) {
			console.log(`Pixel log: ${pixelLog}`);
		}

		// Extract hours from getHoursOfSun log
		const hoursLog = logs.find(l => l.includes('getHoursOfSun:'));
		if (hoursLog) {
			console.log(`Hours log: ${hoursLog}`);
		}

		// Extract kernel keys
		const kernelKeysLog = logs.find(l => l.includes('kernelKeys:'));
		if (kernelKeysLog) {
			console.log('Kernel keys:', kernelKeysLog);
		}

		// Extract layer sun keys
		const layerSunKeysLog = logs.find(l => l.includes('layerSunKeys:'));
		if (layerSunKeysLog) {
			console.log('Layer sun keys:', layerSunKeysLog);
		}

		// Check dirty flag
		const dirtyLog = logs.find(l => l.includes('heightMapDirty:'));
		if (dirtyLog) {
			console.log('HeightMap dirty:', dirtyLog);
		}

		// Check for errors
		const errors = logs.filter(l => l.includes('ERROR') || l.includes('error'));
		if (errors.length > 0) {
			console.log('\n========== ERRORS ==========\n');
			errors.forEach(e => console.log(e));
		}

		// Sample multiple points and calculate hours for each
		const pixelSample = await page.evaluate(() => {
			const canvas = document.querySelector('canvas');
			if (!canvas) return 'No canvas found';

			const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) ||
				canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
			if (!gl) return 'No WebGL context';

			const glContext = gl as WebGLRenderingContext;
			const results: string[] = [];
			const pixel = new Uint8Array(4);

			// Sample a grid and calculate hours using V() formula
			const stepX = Math.floor(canvas.width / 8);
			const stepY = Math.floor(canvas.height / 6);

			// Assuming 24 hour day (86400000 ms)
			const timeRange = 24 * 60 * 60 * 1000;
			const e = 0.5;
			const o = 1 / e;

			for (let yi = 5; yi >= 0; yi--) { // Reverse so top of screen is first row
				const row: string[] = [];
				for (let xi = 0; xi < 8; xi++) {
					const screenX = stepX * xi + stepX / 2;
					const screenY = stepY * yi + stepY / 2;
					// Convert to WebGL coords (flip Y)
					const glY = canvas.height - screenY;
					glContext.readPixels(screenX, glY, 1, 1, glContext.RGBA, glContext.UNSIGNED_BYTE, pixel);

					// V() formula
					const r = Math.min(pixel[0] * o, 255);
					const g = Math.min(pixel[1] * o, 255);
					const b = Math.min(pixel[2] * o, 255);
					let s = 0;
					if (r + g + b !== 0) {
						s = r > 0 ? (r / 255) * 0.5 + 0.5 : b > 0 ? 0.5 * (1 - b / 255) : 0.5;
					}
					const hours = Math.abs((s * timeRange) / 1000 / 3600);
					row.push(hours.toFixed(1).padStart(5));
				}
				results.push(row.join(' '));
			}

			return results;
		});
		console.log('Hours grid (each cell shows calculated sun hours):');
		console.log(pixelSample);

		console.log('\n========== END ==========\n');

		// Take a screenshot to see what's rendered
		await page.screenshot({ path: 'test-results/shademap-debug.png', fullPage: true });
		console.log('Screenshot saved to test-results/shademap-debug.png');

		// Also try to read pixels directly from the canvas
		const canvasData = await page.evaluate(() => {
			const canvases = document.querySelectorAll('canvas');
			const results: string[] = [];
			canvases.forEach((canvas, i) => {
				results.push(`Canvas ${i}: ${canvas.width}x${canvas.height}`);
				results.push(`  window.innerHeight=${window.innerHeight}, canvas.height=${canvas.height}`);

				// Get the existing WebGL context (don't create new one)
				const gl = (canvas as HTMLCanvasElement & { _gl?: WebGLRenderingContext })._gl ||
					canvas.getContext('webgl', { preserveDrawingBuffer: true }) ||
					canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });

				if (gl) {
					const glContext = gl as WebGLRenderingContext;
					results.push(`  WebGL: drawingBufferWidth=${glContext.drawingBufferWidth}, drawingBufferHeight=${glContext.drawingBufferHeight}`);

					// Read center using canvas height (correct for WebGL Y-flip)
					const centerX = Math.floor(canvas.width / 2);
					const centerY = Math.floor(canvas.height / 2); // WebGL origin is bottom-left

					const pixels = new Uint8Array(4);
					glContext.readPixels(centerX, centerY, 1, 1, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);
					results.push(`  Center (${centerX}, ${centerY}): R=${pixels[0]} G=${pixels[1]} B=${pixels[2]} A=${pixels[3]}`);

					// Read multiple points across the canvas
					const testPoints = [
						{ x: 0, y: 0, label: 'bottom-left' },
						{ x: canvas.width - 1, y: 0, label: 'bottom-right' },
						{ x: 0, y: canvas.height - 1, label: 'top-left' },
						{ x: canvas.width - 1, y: canvas.height - 1, label: 'top-right' },
						{ x: centerX, y: 0, label: 'bottom-center' },
						{ x: centerX, y: canvas.height - 1, label: 'top-center' },
					];

					for (const pt of testPoints) {
						glContext.readPixels(pt.x, pt.y, 1, 1, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);
						results.push(`  ${pt.label} (${pt.x}, ${pt.y}): R=${pixels[0]} G=${pixels[1]} B=${pixels[2]} A=${pixels[3]}`);
					}

					// Check framebuffer status
					const fbStatus = glContext.checkFramebufferStatus(glContext.FRAMEBUFFER);
					results.push(`  Framebuffer status: ${fbStatus === glContext.FRAMEBUFFER_COMPLETE ? 'COMPLETE' : fbStatus}`);
				}
			});
			return results;
		});
		console.log('Canvas data:', canvasData);

		// Test getHoursOfSun at different points by calling the exposed interface
		const sunnyPointTest = await page.evaluate(async () => {
			// Wait a bit for everything to be ready
			await new Promise(r => setTimeout(r, 1000));

			// Access the canvas and read a pixel from a sunny area (top-left based on our grid)
			const canvas = document.querySelector('canvas');
			if (!canvas) return { error: 'No canvas' };

			const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
			if (!gl) return { error: 'No WebGL' };

			// Read from top-left area (should have ~9.5 hours based on grid)
			const pixel = new Uint8Array(4);
			const topLeftX = 50;
			const topLeftGlY = canvas.height - 50; // Top in screen = high Y in WebGL
			(gl as WebGLRenderingContext).readPixels(topLeftX, topLeftGlY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

			// Calculate hours using V() formula
			const timeRange = 24 * 60 * 60 * 1000;
			const e = 0.5;
			const o = 1 / e;
			const r = Math.min(pixel[0] * o, 255);
			const g = Math.min(pixel[1] * o, 255);
			const b = Math.min(pixel[2] * o, 255);
			let s = 0;
			if (r + g + b !== 0) {
				s = r > 0 ? (r / 255) * 0.5 + 0.5 : b > 0 ? 0.5 * (1 - b / 255) : 0.5;
			}
			const hours = Math.abs((s * timeRange) / 1000 / 3600);

			return {
				topLeftPixel: `R=${pixel[0]} G=${pixel[1]} B=${pixel[2]} A=${pixel[3]}`,
				topLeftHours: hours.toFixed(2)
			};
		});
		console.log('Sunny point test (top-left):', sunnyPointTest);

		// Verify that sun hours calculation works - top-left should have sun
		expect(sunnyPointTest).toHaveProperty('topLeftHours');
		const topLeftHours = parseFloat(sunnyPointTest.topLeftHours as string);
		expect(topLeftHours).toBeGreaterThan(0); // Should have some sun hours
	});
});

