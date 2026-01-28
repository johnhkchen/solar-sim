// Solar position calculation module
// Handles sun position (altitude, azimuth), sunrise/sunset, and day length

export interface SunPosition {
	altitude: number; // degrees above horizon
	azimuth: number; // compass bearing (0 = North)
}

export interface DayInfo {
	sunrise: Date;
	sunset: Date;
	solarNoon: Date;
	dayLength: number; // hours
}

// Placeholder - implementation pending
export function getSunPosition(
	_latitude: number,
	_longitude: number,
	_date: Date
): SunPosition {
	return { altitude: 0, azimuth: 0 };
}

// Placeholder - implementation pending
export function getDayInfo(
	_latitude: number,
	_longitude: number,
	_date: Date
): DayInfo {
	const now = new Date();
	return {
		sunrise: now,
		sunset: now,
		solarNoon: now,
		dayLength: 0
	};
}
