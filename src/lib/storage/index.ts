/**
 * Storage utilities for persisting user data to localStorage.
 */

export {
	loadLocationData,
	saveLocationData,
	clearLocationData,
	getStorageKey,
	listStoredLocations,
	type StoredLocationData
} from './tree-storage';

export {
	loadPlanState,
	savePlanState,
	clearPlanState,
	getPlanStorageKey,
	isPlanRecent,
	getPlanAgeDays,
	formatLastModified,
	createDebouncedSave,
	listStoredPlans,
	getPlanStats,
	DEFAULT_PREFERENCES,
	type StoredPlanState,
	type PlanPreferences
} from './plan-storage';
