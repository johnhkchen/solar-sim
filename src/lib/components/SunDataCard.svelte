<script lang="ts">
	import type { DailySunData } from '$lib/solar';
	import { getCategoryInfo, type LightCategory } from '$lib/categories';

	interface SunDataCardProps {
		data: DailySunData;
		timezone: string;
	}

	let { data, timezone }: SunDataCardProps = $props();

	const categoryInfo = $derived(getCategoryInfo(data.sunHours));

	const categoryIcons: Record<LightCategory, string> = {
		'full-sun': '☀️',
		'part-sun': '🌤️',
		'part-shade': '⛅',
		'full-shade': '☁️'
	};

	const icon = $derived(categoryIcons[categoryInfo.category]);

	/**
	 * Formats a Date object to a time string in the specified timezone.
	 * Returns null if the date is null (e.g., during polar conditions).
	 */
	function formatTime(date: Date | null): string | null {
		if (!date) return null;

		return date.toLocaleTimeString('en-US', {
			timeZone: timezone,
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	/**
	 * Formats the date for display in the card header.
	 */
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			timeZone: timezone,
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const sunrise = $derived(formatTime(data.sunTimes.sunrise));
	const sunset = $derived(formatTime(data.sunTimes.sunset));
	const dateDisplay = $derived(formatDate(data.date));
</script>

<article class="sun-data-card">
	<header class="card-header">
		<time datetime={data.date.toISOString().split('T')[0]}>{dateDisplay}</time>
	</header>

	<div class="card-body">
		<div class="sun-hours">
			<span class="hours-value">{data.sunHours.toFixed(1)}</span>
			<span class="hours-label">hours of sun</span>
		</div>

		<div class="category">
			<span class="category-icon">{icon}</span>
			<span class="category-label">{categoryInfo.label}</span>
			<span class="category-range">{categoryInfo.sunHoursRange}</span>
		</div>

		{#if data.polarCondition === 'normal'}
			<div class="sun-times">
				<div class="time-block">
					<span class="time-label">Sunrise</span>
					<span class="time-value">{sunrise}</span>
				</div>
				<div class="time-block">
					<span class="time-label">Sunset</span>
					<span class="time-value">{sunset}</span>
				</div>
			</div>
		{:else if data.polarCondition === 'midnight-sun'}
			<div class="polar-notice midnight-sun">
				<span class="polar-icon">🌞</span>
				<span class="polar-text">Midnight sun: 24 hours of daylight</span>
			</div>
		{:else if data.polarCondition === 'polar-night'}
			<div class="polar-notice polar-night">
				<span class="polar-icon">🌑</span>
				<span class="polar-text">Polar night: no sunrise today</span>
			</div>
		{/if}
	</div>
</article>

<style>
	.sun-data-card {
		font-family: system-ui, -apple-system, sans-serif;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		background: #fef3c7;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #fcd34d;
	}

	.card-header time {
		font-size: 0.9375rem;
		color: #78350f;
		font-weight: 500;
	}

	.card-body {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sun-hours {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.hours-value {
		font-size: 2.5rem;
		font-weight: 600;
		color: #92400e;
		line-height: 1;
	}

	.hours-label {
		font-size: 1rem;
		color: #78350f;
	}

	.category {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.category-icon {
		font-size: 1.5rem;
	}

	.category-label {
		font-size: 1.125rem;
		font-weight: 500;
		color: #1a1a1a;
	}

	.category-range {
		font-size: 0.875rem;
		color: #78350f;
		background: #fef3c7;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
	}

	.sun-times {
		display: flex;
		gap: 2rem;
		padding-top: 0.5rem;
		border-top: 1px solid #fcd34d;
	}

	.time-block {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.time-label {
		font-size: 0.8125rem;
		color: #78350f;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.time-value {
		font-size: 1.125rem;
		font-weight: 500;
		color: #1a1a1a;
	}

	.polar-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 4px;
	}

	.polar-notice.midnight-sun {
		background: #fef9c3;
		border: 1px solid #facc15;
	}

	.polar-notice.polar-night {
		background: #f1f5f9;
		border: 1px solid #94a3b8;
	}

	.polar-icon {
		font-size: 1.25rem;
	}

	.polar-text {
		font-size: 0.9375rem;
		color: #333;
	}
</style>
