import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export interface LocationData {
	latitude: number;
	longitude: number;
	timezone: string;
	name: string | null;
}

export const load: PageLoad = ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');
	const tz = url.searchParams.get('tz');
	const name = url.searchParams.get('name');

	// Redirect to home if required parameters are missing
	if (!lat || !lon) {
		redirect(302, '/');
	}

	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);

	// Validate that parsing succeeded
	if (isNaN(latitude) || isNaN(longitude)) {
		redirect(302, '/');
	}

	// Validate latitude bounds (-90 to 90)
	if (latitude < -90 || latitude > 90) {
		redirect(302, '/');
	}

	// Validate longitude bounds (-180 to 180)
	if (longitude < -180 || longitude > 180) {
		redirect(302, '/');
	}

	// Default timezone to UTC if not provided
	const timezone = tz || 'UTC';

	const location: LocationData = {
		latitude,
		longitude,
		timezone,
		name: name || null
	};

	return { location };
};
