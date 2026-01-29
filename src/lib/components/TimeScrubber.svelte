<script lang="ts">
	/**
	 * Time scrubber component for controlling shadow animation.
	 *
	 * This component provides a slider that spans from sunrise to sunset for a given
	 * day and location, letting users scrub through time to see how shadows move
	 * throughout the day. The slider updates the parent via onTimeChange callback,
	 * which can then recalculate shadow positions for the new time.
	 *
	 * During rapid scrubbing, updates are throttled to maintain smooth performance
	 * since shadow recalculation can be computationally expensive.
	 */

	import { getSunTimes, getSunPosition } from '$lib/solar';
	import type { SunTimes, SolarPosition } from '$lib/solar';

	interface TimeScrubberProps {
		date: Date;
		latitude: number;
		longitude: number;
		onTimeChange?: (time: Date, sunPosition: SolarPosition) => void;
	}

	let {
		date,
		latitude,
		longitude,
		onTimeChange
	}: TimeScrubberProps = $props();

	// Internal state for the current time being shown
	let currentTime = $state<Date>(new Date());
	let isPlaying = $state(false);
	let animationFrameId: number | null = null;
	let lastUpdateTime = 0;

	// Compute sun times for the selected day
	const sunTimes = $derived<SunTimes>(getSunTimes({ latitude, longitude }, date));

	// Determine effective start and end times for the slider
	// During polar night there's no sunrise/sunset so we fall back to reasonable defaults
	const sliderStartTime = $derived.by<Date>(() => {
		if (sunTimes.sunrise) return sunTimes.sunrise;
		// Polar conditions: use 6 AM local approximation
		const fallback = new Date(date);
		fallback.setHours(6, 0, 0, 0);
		return fallback;
	});

	const sliderEndTime = $derived.by<Date>(() => {
		if (sunTimes.sunset) return sunTimes.sunset;
		// Polar conditions: use 6 PM local approximation for polar night,
		// or 11:59 PM for midnight sun
		const fallback = new Date(date);
		if (sunTimes.dayLength === 24) {
			fallback.setHours(23, 59, 0, 0);
		} else {
			fallback.setHours(18, 0, 0, 0);
		}
		return fallback;
	});

	// Convert time to slider value (0-1000 for fine granularity)
	const SLIDER_MAX = 1000;

	function timeToSliderValue(time: Date): number {
		const start = sliderStartTime.getTime();
		const end = sliderEndTime.getTime();
		const current = time.getTime();
		const fraction = (current - start) / (end - start);
		return Math.round(Math.max(0, Math.min(SLIDER_MAX, fraction * SLIDER_MAX)));
	}

	function sliderValueToTime(value: number): Date {
		const start = sliderStartTime.getTime();
		const end = sliderEndTime.getTime();
		const fraction = value / SLIDER_MAX;
		return new Date(start + fraction * (end - start));
	}

	// Current slider value - will be set properly in the initialization effect
	let sliderValue = $state(500);

	// Format time for display
	function formatTime(time: Date): string {
		return time.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	// Format date for display
	function formatDate(d: Date): string {
		return d.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Throttle time updates during scrubbing to maintain 30fps target
	const THROTTLE_MS = 33; // ~30fps

	function emitTimeChange(time: Date): void {
		const now = performance.now();
		if (now - lastUpdateTime < THROTTLE_MS) return;
		lastUpdateTime = now;

		const coords = { latitude, longitude };
		const position = getSunPosition(coords, time);
		onTimeChange?.(time, position);
	}

	// Handle slider input
	function handleSliderInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		sliderValue = parseInt(target.value, 10);
		currentTime = sliderValueToTime(sliderValue);
		emitTimeChange(currentTime);
	}

	// Handle slider change (final value when user releases)
	function handleSliderChange(): void {
		// Force an immediate update on release
		lastUpdateTime = 0;
		emitTimeChange(currentTime);
	}

	// Animation loop for play mode
	function animate(): void {
		if (!isPlaying) return;

		// Advance time by 5 simulated minutes per real second
		const realDelta = 16; // ~60fps frame time
		const simulatedDelta = realDelta * 5 * 60; // 5 minutes per second in ms

		const newTime = new Date(currentTime.getTime() + simulatedDelta);
		const end = sliderEndTime;

		if (newTime >= end) {
			// Reached sunset, stop playing
			currentTime = end;
			sliderValue = SLIDER_MAX;
			isPlaying = false;
			emitTimeChange(currentTime);
			return;
		}

		currentTime = newTime;
		sliderValue = timeToSliderValue(currentTime);
		emitTimeChange(currentTime);

		animationFrameId = requestAnimationFrame(animate);
	}

	// Toggle play/pause
	function togglePlay(): void {
		if (isPlaying) {
			isPlaying = false;
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
		} else {
			// If at end, restart from beginning
			if (sliderValue >= SLIDER_MAX - 10) {
				sliderValue = 0;
				currentTime = sliderStartTime;
			}
			isPlaying = true;
			animationFrameId = requestAnimationFrame(animate);
		}
	}

	// Jump to specific times
	function goToSunrise(): void {
		isPlaying = false;
		sliderValue = 0;
		currentTime = sliderStartTime;
		lastUpdateTime = 0;
		emitTimeChange(currentTime);
	}

	function goToNoon(): void {
		isPlaying = false;
		currentTime = sunTimes.solarNoon;
		sliderValue = timeToSliderValue(currentTime);
		lastUpdateTime = 0;
		emitTimeChange(currentTime);
	}

	function goToSunset(): void {
		isPlaying = false;
		sliderValue = SLIDER_MAX;
		currentTime = sliderEndTime;
		lastUpdateTime = 0;
		emitTimeChange(currentTime);
	}

	// Initialize to solar noon when props change
	// We need to read the prop values directly to track them properly in Svelte 5
	$effect(() => {
		// Track these by reading them - Svelte 5 tracks what you read, not what you assign
		void date.getTime();
		void latitude;
		void longitude;

		// Reset to solar noon when date or location changes
		const noon = sunTimes.solarNoon;
		currentTime = noon;
		sliderValue = timeToSliderValue(noon);
		lastUpdateTime = 0;
		emitTimeChange(noon);
	});

	// Cleanup animation on unmount
	$effect(() => {
		return () => {
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});

	// Sun position for the current time
	const currentSunPosition = $derived<SolarPosition>(
		getSunPosition({ latitude, longitude }, currentTime)
	);

	// Is the sun above the horizon?
	const sunIsUp = $derived(currentSunPosition.altitude > 0);
</script>

<div class="time-scrubber">
	<div class="header">
		<div class="date-info">
			<span class="date">{formatDate(date)}</span>
			<span class="day-length">
				{#if sunTimes.sunrise && sunTimes.sunset}
					{sunTimes.dayLength.toFixed(1)}h daylight
				{:else if sunTimes.dayLength === 24}
					24h daylight (midnight sun)
				{:else}
					No daylight (polar night)
				{/if}
			</span>
		</div>
		<div class="time-display">
			<span class="current-time">{formatTime(currentTime)}</span>
			{#if sunIsUp}
				<span class="sun-badge up" title="Sun is up">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<circle cx="12" cy="12" r="5" />
						<path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" stroke-width="2" fill="none" />
					</svg>
				</span>
			{:else}
				<span class="sun-badge down" title="Sun below horizon">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 3a9 9 0 1 0 9 9c0-5-4-9-9-9z" />
					</svg>
				</span>
			{/if}
		</div>
	</div>

	<div class="slider-container">
		<button
			type="button"
			class="time-btn"
			onclick={goToSunrise}
			title="Jump to sunrise"
			aria-label="Jump to sunrise"
		>
			{formatTime(sliderStartTime)}
		</button>

		<div class="slider-wrapper">
			<input
				type="range"
				class="time-slider"
				min="0"
				max={SLIDER_MAX}
				value={sliderValue}
				oninput={handleSliderInput}
				onchange={handleSliderChange}
				aria-label="Time of day"
			/>
			<div class="slider-track">
				<div class="slider-fill" style="width: {(sliderValue / SLIDER_MAX) * 100}%"></div>
			</div>
		</div>

		<button
			type="button"
			class="time-btn"
			onclick={goToSunset}
			title="Jump to sunset"
			aria-label="Jump to sunset"
		>
			{formatTime(sliderEndTime)}
		</button>
	</div>

	<div class="controls">
		<button
			type="button"
			class="control-btn"
			onclick={goToSunrise}
			title="Sunrise"
			aria-label="Jump to sunrise"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M17 18a5 5 0 0 0-10 0" />
				<line x1="12" y1="9" x2="12" y2="2" />
				<line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
				<line x1="1" y1="18" x2="3" y2="18" />
				<line x1="21" y1="18" x2="23" y2="18" />
				<line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
				<line x1="23" y1="22" x2="1" y2="22" />
				<polyline points="8 6 12 2 16 6" />
			</svg>
		</button>

		<button
			type="button"
			class="control-btn play-btn"
			onclick={togglePlay}
			title={isPlaying ? 'Pause' : 'Play'}
			aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
		>
			{#if isPlaying}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
			{/if}
		</button>

		<button
			type="button"
			class="control-btn"
			onclick={goToNoon}
			title="Solar noon"
			aria-label="Jump to solar noon"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="5" />
				<line x1="12" y1="1" x2="12" y2="3" />
				<line x1="12" y1="21" x2="12" y2="23" />
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
				<line x1="1" y1="12" x2="3" y2="12" />
				<line x1="21" y1="12" x2="23" y2="12" />
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
			</svg>
		</button>

		<button
			type="button"
			class="control-btn"
			onclick={goToSunset}
			title="Sunset"
			aria-label="Jump to sunset"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M17 18a5 5 0 0 0-10 0" />
				<line x1="12" y1="9" x2="12" y2="2" />
				<line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
				<line x1="1" y1="18" x2="3" y2="18" />
				<line x1="21" y1="18" x2="23" y2="18" />
				<line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
				<line x1="23" y1="22" x2="1" y2="22" />
				<polyline points="8 6 12 10 16 6" />
			</svg>
		</button>
	</div>

	{#if currentSunPosition.altitude > 0}
		<div class="sun-info">
			Sun altitude: {currentSunPosition.altitude.toFixed(1)}° &middot;
			Azimuth: {currentSunPosition.azimuth.toFixed(0)}° ({getCompassDirection(currentSunPosition.azimuth)})
		</div>
	{:else}
		<div class="sun-info below">
			Sun {Math.abs(currentSunPosition.altitude).toFixed(1)}° below horizon
		</div>
	{/if}
</div>

<script lang="ts" module>
	/**
	 * Converts a compass bearing to a direction label.
	 */
	function getCompassDirection(bearing: number): string {
		const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
		const index = Math.round(bearing / 22.5) % 16;
		return directions[index];
	}
</script>

<style>
	.time-scrubber {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: #fafaf9;
		border: 1px solid #e7e5e4;
		border-radius: 8px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.date-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.date {
		font-weight: 500;
		font-size: 0.9375rem;
		color: #1c1917;
	}

	.day-length {
		font-size: 0.75rem;
		color: #78716c;
	}

	.time-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.current-time {
		font-size: 1.25rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #1c1917;
	}

	.sun-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
	}

	.sun-badge.up {
		background: #fef3c7;
		color: #d97706;
	}

	.sun-badge.down {
		background: #e7e5e4;
		color: #78716c;
	}

	.slider-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.time-btn {
		padding: 0.25rem 0.5rem;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 4px;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: #57534e;
		cursor: pointer;
		white-space: nowrap;
	}

	.time-btn:hover {
		background: #f5f5f4;
		border-color: #a8a29e;
	}

	.slider-wrapper {
		flex: 1;
		position: relative;
		height: 20px;
	}

	.time-slider {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 2;
	}

	.slider-track {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 6px;
		transform: translateY(-50%);
		background: #e7e5e4;
		border-radius: 3px;
		overflow: hidden;
	}

	.slider-fill {
		height: 100%;
		background: linear-gradient(90deg, #fbbf24, #f59e0b);
		border-radius: 3px;
		transition: width 0.05s ease-out;
	}

	.controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: white;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
		color: #57534e;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: #f5f5f4;
		border-color: #a8a29e;
		color: #1c1917;
	}

	.play-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: #f59e0b;
		border-color: #d97706;
		color: white;
	}

	.play-btn:hover {
		background: #d97706;
		border-color: #b45309;
		color: white;
	}

	.sun-info {
		text-align: center;
		font-size: 0.8125rem;
		color: #57534e;
	}

	.sun-info.below {
		color: #a8a29e;
		font-style: italic;
	}
</style>
