<script lang="ts">
	import { goto } from '$app/navigation';
	import { LocationInput, type Location } from '$lib/components';

	function handleLocationSelect(location: Location): void {
		const params = new URLSearchParams();
		params.set('lat', location.latitude.toString());
		params.set('lon', location.longitude.toString());
		params.set('tz', location.timezone);
		if (location.name) {
			params.set('name', location.name);
		}
		goto(`/results?${params.toString()}`);
	}
</script>

<main>
	<h1>Solar-Sim</h1>
	<p>Calculate sun hours and light categories for any location on Earth.</p>

	<section>
		<h2>Enter Location</h2>
		<LocationInput onselect={handleLocationSelect} />
	</section>
</main>

<style>
	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		color: #333;
	}

	section {
		margin-top: 1.5rem;
	}

	h2 {
		color: #555;
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}
</style>
