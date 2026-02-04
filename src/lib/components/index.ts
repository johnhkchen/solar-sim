// Reusable UI components

export { default as LocationInput } from './LocationInput.svelte';
export { default as SunDataCard } from './SunDataCard.svelte';
export { default as PlotEditor } from './PlotEditor.svelte';
export { default as PlotViewer } from './PlotViewer.svelte';
export { default as ShadeResults } from './ShadeResults.svelte';
export { default as GrowingSeasonTimeline } from './GrowingSeasonTimeline.svelte';
export { default as PlantRecommendations } from './PlantRecommendations.svelte';
export { default as PlantingCalendar } from './PlantingCalendar.svelte';
export { default as SeasonalLightChart } from './SeasonalLightChart.svelte';
export { default as TemperatureChart } from './TemperatureChart.svelte';
export { default as MapPicker } from './MapPicker.svelte';
export { default as TreeConfigPanel } from './TreeConfigPanel.svelte';
export { default as SunHoursDisplay } from './SunHoursDisplay.svelte';
export { default as GardeningGuidance } from './GardeningGuidance.svelte';
export { default as TimeScrubber } from './TimeScrubber.svelte';
export { default as IsometricView } from './IsometricView.svelte';
export type { IsometricDisplayMode } from './IsometricView.svelte';
export { default as ExposureHeatmap } from './ExposureHeatmap.svelte';
export { default as PeriodSelector } from './PeriodSelector.svelte';
export { default as SpotInspector } from './SpotInspector.svelte';
export { default as ReactiveHeatmap } from './ReactiveHeatmap.svelte';
export { default as PhaseIndicator } from './PhaseIndicator.svelte';
export { default as PhasePanel } from './PhasePanel.svelte';
export { default as BottomSheet } from './BottomSheet.svelte';
export { default as ZoneEditor } from './ZoneEditor.svelte';
export { default as ZoneList } from './ZoneList.svelte';
export { default as FilterChips } from './FilterChips.svelte';
export { default as PlantCard } from './PlantCard.svelte';
export { default as PlantDetail } from './PlantDetail.svelte';
export { default as PlantSelector } from './PlantSelector.svelte';
export type { ZonePlantSelection } from './PlantSelector.svelte';
export { default as PlantMarker } from './PlantMarker.svelte';
export { PLANT_COLORS, generatePlantCode, getSpacingStatus } from './PlantMarker.svelte';
export type { SpacingStatus } from './PlantMarker.svelte';
export { default as PlanCanvas } from './PlanCanvas.svelte';
export { feetToMeters, metersToFeet } from './PlanCanvas.svelte';
export type { ViewMode } from './PlanCanvas.svelte';
export { default as ViewToggle } from './ViewToggle.svelte';
export { default as ContinuePlanDialog } from './ContinuePlanDialog.svelte';
export { default as ClearPlanButton } from './ClearPlanButton.svelte';

// Re-export types for convenience when using components
export type { Location } from '$lib/geo';
export type { DailySunData } from '$lib/solar';
export type { PlotObstacle } from './PlotEditor.svelte';
export type { MonthlySunData } from './SeasonalLightChart.svelte';
export type { MapTree, TreePreset, ObservationPoint, ShadeMapInterface } from './MapPicker.svelte';
export { TREE_PRESETS } from './MapPicker.svelte';
export type { HeatmapColorStop, HeatmapClickEvent } from './ExposureHeatmap.svelte';
export { DEFAULT_COLOR_SCALE } from './ExposureHeatmap.svelte';
export type { PeriodPreset, AnalysisPeriod } from './PeriodSelector.svelte';
export { MONTHS } from './PeriodSelector.svelte';
export type { InspectedSpot } from './SpotInspector.svelte';
export type { ReactiveHeatmapState } from './ReactiveHeatmap.svelte';
export type { Phase } from './PhaseIndicator.svelte';
export type { Zone, PlacedPlant } from './ZoneEditor.svelte';
export {
	LIGHT_THRESHOLDS,
	LIGHT_COLORS,
	classifyLightCategory,
	generateZoneName,
	calculateZoneArea,
	formatArea
} from './ZoneEditor.svelte';
