/**
 * localStorage persistence for complete garden plan state.
 *
 * Saves zones, selected plants, current phase, analysis period, and user preferences
 * so users can return to their work in progress. Plan state is keyed by location
 * coordinates at higher precision than tree storage since plans are more specific.
 */

import type { Zone, PlacedPlant, Phase, AnalysisPeriod } from '$lib/components';
import type { PlotObstacle } from '$lib/components/PlotEditor.svelte';
import type { PlotSlope } from '$lib/solar/slope';

/** Current schema version for migration support */
const CURRENT_VERSION = 1;

/** Storage key prefix for plan data */
const STORAGE_PREFIX = 'solar-sim:plan:';

/** Coordinate precision for plan storage key (4 decimals = ~11m) */
const COORDINATE_PRECISION = 4;

/** Maximum age in days before showing "old plan" warning */
const MAX_AGE_DAYS = 30;

/**
 * User preference filters that affect plant recommendations.
 */
export interface PlanPreferences {
	native: boolean;
	edible: boolean;
	lowWater: boolean;
	deerResistant: boolean;
	evergreen: boolean;
}

/**
 * The complete plan state stored in localStorage.
 */
export interface StoredPlanState {
	version: number;
	location: {
		lat: number;
		lng: number;
		name: string;
	};
	zones: Zone[];
	currentPhase: Phase;
	completedPhases: Phase[];
	analysisPeriod: {
		type: 'growing-season' | 'full-year' | 'custom';
		startDate: string;
		endDate: string;
	};
	preferences: PlanPreferences;
	obstacles: PlotObstacle[];
	slope: PlotSlope;
	lastModified: string;
}

/**
 * Default preferences for new plans.
 */
export const DEFAULT_PREFERENCES: PlanPreferences = {
	native: false,
	edible: false,
	lowWater: false,
	deerResistant: false,
	evergreen: false
};

/**
 * Rounds a coordinate to the configured precision level.
 */
function roundCoordinate(coord: number): number {
	const factor = Math.pow(10, COORDINATE_PRECISION);
	return Math.round(coord * factor) / factor;
}

/**
 * Creates a storage key for the given coordinates.
 */
export function getPlanStorageKey(lat: number, lng: number): string {
	const roundedLat = roundCoordinate(lat);
	const roundedLng = roundCoordinate(lng);
	return `${STORAGE_PREFIX}${roundedLat}:${roundedLng}`;
}

/**
 * Validates a zone object has all required fields.
 */
function isValidZone(zone: unknown): zone is Zone {
	if (typeof zone !== 'object' || zone === null) return false;

	const z = zone as Record<string, unknown>;
	return (
		typeof z.id === 'string' &&
		typeof z.name === 'string' &&
		typeof z.bounds === 'object' &&
		z.bounds !== null &&
		typeof z.sunHours === 'number' &&
		typeof z.lightCategory === 'string' &&
		Array.isArray(z.plants)
	);
}

/**
 * Validates a placed plant object.
 */
function isValidPlacedPlant(plant: unknown): plant is PlacedPlant {
	if (typeof plant !== 'object' || plant === null) return false;

	const p = plant as Record<string, unknown>;
	return (
		typeof p.plantId === 'string' &&
		typeof p.quantity === 'number' &&
		p.quantity > 0
	);
}

/**
 * Validates preferences object has correct structure.
 */
function isValidPreferences(prefs: unknown): prefs is PlanPreferences {
	if (typeof prefs !== 'object' || prefs === null) return false;

	const p = prefs as Record<string, unknown>;
	return (
		typeof p.native === 'boolean' &&
		typeof p.edible === 'boolean' &&
		typeof p.lowWater === 'boolean' &&
		typeof p.deerResistant === 'boolean' &&
		typeof p.evergreen === 'boolean'
	);
}

/**
 * Validates and repairs stored plan data.
 * Returns null if data is fundamentally broken.
 */
function validateStoredPlan(data: unknown): StoredPlanState | null {
	if (typeof data !== 'object' || data === null) return null;

	const d = data as Record<string, unknown>;

	// Check version - allow migration from older versions
	if (typeof d.version !== 'number') return null;
	if (d.version > CURRENT_VERSION) return null;

	// Validate location
	if (typeof d.location !== 'object' || d.location === null) return null;
	const loc = d.location as Record<string, unknown>;
	if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
	const locationName = typeof loc.name === 'string' ? loc.name : '';

	// Validate zones - filter out invalid ones
	let zones: Zone[] = [];
	if (Array.isArray(d.zones)) {
		zones = d.zones.filter(isValidZone).map(zone => ({
			...zone,
			plants: Array.isArray(zone.plants)
				? zone.plants.filter(isValidPlacedPlant)
				: []
		}));
	}

	// Validate phase
	const validPhases: Phase[] = ['site', 'analysis', 'plants', 'plan'];
	const currentPhase = validPhases.includes(d.currentPhase as Phase)
		? (d.currentPhase as Phase)
		: 'site';

	// Validate completed phases
	let completedPhases: Phase[] = [];
	if (Array.isArray(d.completedPhases)) {
		completedPhases = d.completedPhases.filter(
			(p): p is Phase => validPhases.includes(p as Phase)
		);
	}

	// Validate analysis period
	let analysisPeriod: StoredPlanState['analysisPeriod'];
	if (typeof d.analysisPeriod === 'object' && d.analysisPeriod !== null) {
		const ap = d.analysisPeriod as Record<string, unknown>;
		const type = ['growing-season', 'full-year', 'custom'].includes(ap.type as string)
			? (ap.type as 'growing-season' | 'full-year' | 'custom')
			: 'growing-season';
		analysisPeriod = {
			type,
			startDate: typeof ap.startDate === 'string' ? ap.startDate : new Date().toISOString(),
			endDate: typeof ap.endDate === 'string' ? ap.endDate : new Date().toISOString()
		};
	} else {
		const now = new Date();
		analysisPeriod = {
			type: 'growing-season',
			startDate: new Date(now.getFullYear(), 3, 1).toISOString(),
			endDate: new Date(now.getFullYear(), 9, 31).toISOString()
		};
	}

	// Validate preferences
	const preferences = isValidPreferences(d.preferences)
		? d.preferences
		: DEFAULT_PREFERENCES;

	// Validate obstacles
	let obstacles: PlotObstacle[] = [];
	if (Array.isArray(d.obstacles)) {
		obstacles = d.obstacles.filter(
			(o): o is PlotObstacle =>
				typeof o === 'object' &&
				o !== null &&
				typeof (o as Record<string, unknown>).type === 'string' &&
				typeof (o as Record<string, unknown>).azimuth === 'number' &&
				typeof (o as Record<string, unknown>).elevationAngle === 'number'
		);
	}

	// Validate slope
	let slope: PlotSlope = { angle: 0, aspect: 180 };
	if (typeof d.slope === 'object' && d.slope !== null) {
		const s = d.slope as Record<string, unknown>;
		if (typeof s.angle === 'number' && typeof s.aspect === 'number') {
			slope = { angle: s.angle, aspect: s.aspect };
		}
	}

	// Validate timestamp
	const lastModified = typeof d.lastModified === 'string'
		? d.lastModified
		: new Date().toISOString();

	return {
		version: CURRENT_VERSION,
		location: {
			lat: loc.lat as number,
			lng: loc.lng as number,
			name: locationName
		},
		zones,
		currentPhase,
		completedPhases,
		analysisPeriod,
		preferences,
		obstacles,
		slope,
		lastModified
	};
}

/**
 * Loads stored plan state for the given coordinates.
 * Returns null if no plan exists or data is corrupted.
 */
export function loadPlanState(lat: number, lng: number): StoredPlanState | null {
	if (typeof window === 'undefined' || !window.localStorage) return null;

	const key = getPlanStorageKey(lat, lng);

	try {
		const stored = window.localStorage.getItem(key);
		if (!stored) return null;

		const parsed = JSON.parse(stored);
		return validateStoredPlan(parsed);
	} catch (e) {
		console.warn(`Failed to load plan state for ${key}:`, e);
		return null;
	}
}

/**
 * Saves plan state for the given coordinates.
 */
export function savePlanState(state: StoredPlanState): void {
	if (typeof window === 'undefined' || !window.localStorage) return;

	const key = getPlanStorageKey(state.location.lat, state.location.lng);

	// Update timestamp
	const toSave: StoredPlanState = {
		...state,
		version: CURRENT_VERSION,
		lastModified: new Date().toISOString()
	};

	try {
		window.localStorage.setItem(key, JSON.stringify(toSave));
	} catch (e) {
		console.warn(`Failed to save plan state for ${key}:`, e);
	}
}

/**
 * Clears plan state for the given coordinates.
 */
export function clearPlanState(lat: number, lng: number): void {
	if (typeof window === 'undefined' || !window.localStorage) return;

	const key = getPlanStorageKey(lat, lng);

	try {
		window.localStorage.removeItem(key);
	} catch (e) {
		console.warn(`Failed to clear plan state for ${key}:`, e);
	}
}

/**
 * Checks if a stored plan is recent (less than MAX_AGE_DAYS old).
 */
export function isPlanRecent(state: StoredPlanState): boolean {
	const lastModified = new Date(state.lastModified);
	const now = new Date();
	const ageMs = now.getTime() - lastModified.getTime();
	const ageDays = ageMs / (1000 * 60 * 60 * 24);
	return ageDays < MAX_AGE_DAYS;
}

/**
 * Returns the age of a stored plan in days.
 */
export function getPlanAgeDays(state: StoredPlanState): number {
	const lastModified = new Date(state.lastModified);
	const now = new Date();
	const ageMs = now.getTime() - lastModified.getTime();
	return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats the last modified date for display.
 */
export function formatLastModified(state: StoredPlanState): string {
	const date = new Date(state.lastModified);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
	});
}

/**
 * Creates a debounced save function for auto-saving plan state.
 */
export function createDebouncedSave(delay: number = 500): {
	save: (state: StoredPlanState) => void;
	cancel: () => void;
} {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return {
		save: (state: StoredPlanState) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			timeoutId = setTimeout(() => {
				savePlanState(state);
				timeoutId = null;
			}, delay);
		},
		cancel: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		}
	};
}

/**
 * Lists all stored plan keys for debugging and admin purposes.
 */
export function listStoredPlans(): string[] {
	if (typeof window === 'undefined' || !window.localStorage) return [];

	const storage = window.localStorage;
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key && key.startsWith(STORAGE_PREFIX)) {
			keys.push(key);
		}
	}
	return keys;
}

/**
 * Calculates storage statistics for the current plan.
 */
export function getPlanStats(state: StoredPlanState): {
	zoneCount: number;
	plantCount: number;
	hasObstacles: boolean;
} {
	const plantCount = state.zones.reduce(
		(sum, zone) => sum + zone.plants.reduce((pSum, p) => pSum + p.quantity, 0),
		0
	);
	return {
		zoneCount: state.zones.length,
		plantCount,
		hasObstacles: state.obstacles.length > 0
	};
}
