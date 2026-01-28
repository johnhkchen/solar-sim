// Geographic and timezone handling module
// Handles coordinate validation, timezone inference, and geocoding

export interface Coordinates {
	latitude: number;
	longitude: number;
}

export interface Location extends Coordinates {
	timezone: string;
	name?: string;
}

// Placeholder - implementation pending
export function validateCoordinates(lat: number, lng: number): boolean {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Placeholder - implementation pending
export function inferTimezone(_coordinates: Coordinates): string {
	return 'UTC';
}
