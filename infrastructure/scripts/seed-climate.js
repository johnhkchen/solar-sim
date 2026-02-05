#!/usr/bin/env node
/**
 * =============================================================================
 * Pre-cache Climate Data for Bay Area
 * Fetches 30 years of historical temperature data for a grid of points
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Bay Area bounding box
const BOUNDS = {
	north: 38.9,
	south: 36.9,
	west: -123.5,
	east: -121.0
};

// Grid spacing in degrees (~10km)
const GRID_STEP = 0.1;

// Open-Meteo historical API endpoint
const API_BASE = 'https://archive-api.open-meteo.com/v1/archive';

// Rate limit: 1 request per second to be respectful
const RATE_LIMIT_MS = 1000;

// Output directory
const DATA_DIR = path.join(__dirname, '..', 'data', 'climate');

// 30 years of historical data
const START_DATE = '1994-01-01';
const END_DATE = '2023-12-31';

/**
 * Fetch historical temperature data for a location
 */
async function fetchClimateData(lat, lng) {
	const params = new URLSearchParams({
		latitude: lat.toFixed(4),
		longitude: lng.toFixed(4),
		start_date: START_DATE,
		end_date: END_DATE,
		daily: 'temperature_2m_max,temperature_2m_min',
		timezone: 'auto'
	});

	const url = `${API_BASE}?${params}`;

	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							resolve(JSON.parse(data));
						} catch (e) {
							reject(new Error(`Invalid JSON: ${e.message}`));
						}
					} else if (res.statusCode === 429) {
						reject(new Error('Rate limited'));
					} else {
						reject(new Error(`HTTP ${res.statusCode}`));
					}
				});
			})
			.on('error', reject);
	});
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate cache key from coordinates (rounded to 0.1 degree)
 */
function cacheKey(lat, lng) {
	const latBucket = Math.round(lat * 10) / 10;
	const lngBucket = Math.round(lng * 10) / 10;
	return `${latBucket.toFixed(1)}_${lngBucket.toFixed(1)}`;
}

/**
 * Main seeding function
 */
async function main() {
	console.log('========================================');
	console.log('Solar-Sim Climate Data Seeder');
	console.log('========================================');
	console.log('');
	console.log(`Grid: ${BOUNDS.south}°N to ${BOUNDS.north}°N`);
	console.log(`      ${BOUNDS.west}°W to ${BOUNDS.east}°W`);
	console.log(`Step: ${GRID_STEP}° (~10km)`);
	console.log('');

	// Create output directory
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	// Generate grid points
	const points = [];
	for (let lat = BOUNDS.south; lat <= BOUNDS.north; lat += GRID_STEP) {
		for (let lng = BOUNDS.west; lng <= BOUNDS.east; lng += GRID_STEP) {
			points.push({ lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 });
		}
	}

	console.log(`Total grid points: ${points.length}`);
	console.log('');

	let downloaded = 0;
	let skipped = 0;
	let failed = 0;

	for (let i = 0; i < points.length; i++) {
		const { lat, lng } = points[i];
		const key = cacheKey(lat, lng);
		const filePath = path.join(DATA_DIR, `${key}.json`);

		// Progress indicator
		const progress = `[${i + 1}/${points.length}]`;

		// Check if already cached
		if (fs.existsSync(filePath)) {
			const stats = fs.statSync(filePath);
			// Consider valid if > 1KB and < 30 days old
			const age = Date.now() - stats.mtimeMs;
			if (stats.size > 1000 && age < 30 * 24 * 60 * 60 * 1000) {
				process.stdout.write(`${progress} ${key} - cached\r`);
				skipped++;
				continue;
			}
		}

		process.stdout.write(`${progress} ${key} - fetching...`);

		try {
			const data = await fetchClimateData(lat, lng);

			// Save to file
			fs.writeFileSync(
				filePath,
				JSON.stringify({
					lat,
					lng,
					fetchedAt: new Date().toISOString(),
					data
				})
			);

			console.log(` OK (${Math.round(fs.statSync(filePath).size / 1024)}KB)`);
			downloaded++;
		} catch (err) {
			console.log(` FAILED: ${err.message}`);
			failed++;

			// If rate limited, wait longer
			if (err.message === 'Rate limited') {
				console.log('  Rate limited, waiting 60 seconds...');
				await sleep(60000);
			}
		}

		// Rate limit
		await sleep(RATE_LIMIT_MS);
	}

	console.log('');
	console.log('========================================');
	console.log('Seeding Complete');
	console.log('========================================');
	console.log(`  Downloaded: ${downloaded}`);
	console.log(`  Skipped:    ${skipped}`);
	console.log(`  Failed:     ${failed}`);
	console.log('');

	// Calculate total size
	const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
	let totalSize = 0;
	files.forEach((f) => {
		totalSize += fs.statSync(path.join(DATA_DIR, f)).size;
	});
	console.log(`Total cached: ${files.length} locations (${Math.round(totalSize / 1024 / 1024)}MB)`);
}

// Run
main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
