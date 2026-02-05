<script lang="ts">
	import {
		getDailySunHours,
		getDailySunHoursWithShade,
		getYearlySummary,
		getSeasonalSummaryWithShade,
		calculateCombinedSunHoursSync,
		type Coordinates,
		type DailySunData,
		type Obstacle,
		type MapTreeConfig,
		type CombinedSunHoursResult
	} from '$lib/solar';
	import {
		SunDataCard,
		GrowingSeasonTimeline,
		PlantRecommendations,
		PlantingCalendar,
		SeasonalLightChart,
		TemperatureChart,
		PlotViewer,
		MapPicker,
		SunHoursDisplay,
		GardeningGuidance,
		PhaseIndicator,
		PhasePanel,
		BottomSheet,
		PeriodSelector,
		SpotInspector,
		ZoneEditor,
		ZoneList,
		PlantSelector,
		PlanCanvas,
		ViewToggle,
		ContinuePlanDialog,
		ClearPlanButton,
		type MonthlySunData,
		type PlotObstacle,
		type MapTree,
		type ObservationPoint,
		type Phase,
		type AnalysisPeriod,
		type InspectedSpot,
		type Zone,
		type PlacedPlant,
		type ViewMode,
		type ShadeMapInterface
	} from '$lib/components';
	import {
		loadPlanState,
		savePlanState,
		clearPlanState,
		createDebouncedSave,
		DEFAULT_PREFERENCES,
		type StoredPlanState,
		type PlanPreferences
	} from '$lib/storage';
	import type { PlotSlope } from '$lib/solar/slope';
	import {
		getFrostDates,
		getHardinessZone,
		calculateGrowingSeasonLength,
		dayOfYearToDate,
		formatHardinessZone,
		formatZoneTempRange,
		fetchHistoricalTemperatures,
		calculateMonthlyAverages,
		calculateFrostDatesFromHistory,
		classifyKoppen,
		getCompleteOutlook,
		formatOutlookCategory,
		formatDroughtStatus,
		type FrostDates,
		type HardinessZone,
		type GrowingSeason,
		type GrowingSeasonRange,
		type ClimateData,
		type MonthlyAverages,
		type KoppenClassification,
		type CombinedOutlook,
		dateToDayOfYear
	} from '$lib/climate';
	import { getRecommendations, createRecommendationInput, getPlantById } from '$lib/plants';
	import {
		generatePlanPdf,
		capturePlanImage,
		type PdfExportData,
		type SeasonalShadeImages
	} from '$lib/export';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';

	const { data }: { data: PageData } = $props();

	// Location is guaranteed to be valid by the load function
	const { latitude, longitude, timezone, name } = data.location;

	// Calculate sun data for the validated coordinates
	const coords: Coordinates = { latitude, longitude };
	const sunData: DailySunData = $derived(getDailySunHours(coords, new Date()));

	// Fetch climate data for the location (fallback to embedded tables)
	const frostDates: FrostDates = $derived(getFrostDates(coords));
	const hardinessZone: HardinessZone = $derived(getHardinessZone(coords));

	// Phase navigation state
	let currentPhase = $state<Phase>('site');
	let completedPhases = $state<Phase[]>([]);
	let isMobile = $state(false);
	let bottomSheetExpanded = $state(false);

	// Analysis phase state
	let analysisPeriod = $state<AnalysisPeriod>({
		preset: 'growing-season',
		startDoy: 91, // April 1
		endDoy: 304, // October 31
		label: 'Growing Season'
	});
	let inspectedSpot = $state<InspectedSpot | null>(null);
	let allowBuildingFetch = $state(true); // Enable building fetch for Site phase shadow exploration
	let analysisDate = $state(new Date()); // Current date for sun analysis

	// Plants phase state - zones
	let zones = $state<Zone[]>([]);
	let selectedZoneId = $state<string | null>(null);
	let zoneDrawingMode = $state(false);
	let mapRef = $state<L.Map | null>(null);
	let zoneEditorRef: ZoneEditor | null = null;

	// View mode state (map vs plan)
	let viewMode = $state<ViewMode>('map');

	// PDF export state
	let isExporting = $state(false);
	let planCanvasRef: SVGSVGElement | null = null;

	// Plot viewer state for obstacles and slope
	let obstacles = $state<PlotObstacle[]>([]);
	let slope = $state<PlotSlope>({ angle: 0, aspect: 180 });

	// Garden planner state for MapPicker features
	let plannerTrees = $state<MapTree[]>([]);
	let observationPoint = $state<ObservationPoint | undefined>(undefined);
	let shadeMapInterface = $state<ShadeMapInterface | null>(null);

	// User preferences for plant filtering
	let preferences = $state<PlanPreferences>({ ...DEFAULT_PREFERENCES });

	// Plan restore dialog state
	let pendingPlanState = $state<StoredPlanState | null>(null);
	let showRestoreDialog = $state(false);

	// Convert MapTree to MapTreeConfig for sun-hours calculation
	const plannerTreeConfigs = $derived<MapTreeConfig[]>(
		plannerTrees.map((t) => ({
			id: t.id,
			lat: t.lat,
			lng: t.lng,
			type: t.type,
			height: t.height,
			canopyWidth: t.canopyWidth
		}))
	);

	// Calculate combined sun hours at the observation point for gardening guidance.
	const plannerSunHours = $derived.by<CombinedSunHoursResult | null>(() => {
		if (!observationPoint) return null;
		const obsLatLng = { lat: observationPoint.lat, lng: observationPoint.lng };
		return calculateCombinedSunHoursSync(obsLatLng, plannerTreeConfigs, coords, new Date());
	});

	// Phase navigation helpers
	const PHASE_ORDER: Phase[] = ['site', 'analysis', 'plants', 'plan'];

	function getPhaseIndex(phase: Phase): number {
		return PHASE_ORDER.indexOf(phase);
	}

	function canAdvanceToPhase(phase: Phase): boolean {
		const targetIndex = getPhaseIndex(phase);
		const currentIndex = getPhaseIndex(currentPhase);

		// Can always go back
		if (targetIndex <= currentIndex) return true;

		// Can only advance one step at a time
		if (targetIndex > currentIndex + 1) {
			// Check if all intermediate phases would be completed
			for (let i = currentIndex; i < targetIndex; i++) {
				const intermediatePhase = PHASE_ORDER[i];
				if (!completedPhases.includes(intermediatePhase) && intermediatePhase !== currentPhase) {
					return false;
				}
			}
		}

		// Validate forward navigation requirements
		if (phase === 'analysis') {
			// Can go to analysis once site is set up (always allowed)
			return true;
		}
		if (phase === 'plants') {
			// Can advance to plants from analysis (no prerequisites)
			return currentPhase === 'analysis' || completedPhases.includes('analysis');
		}
		if (phase === 'plan') {
			// Can advance to plan from plants (no prerequisites for now)
			return currentPhase === 'plants' || completedPhases.includes('plants');
		}
		return false;
	}

	function goToPhase(phase: Phase) {
		if (!canAdvanceToPhase(phase)) return;

		// Mark current phase as completed when moving forward
		const currentIndex = getPhaseIndex(currentPhase);
		const targetIndex = getPhaseIndex(phase);

		if (targetIndex > currentIndex && !completedPhases.includes(currentPhase)) {
			completedPhases = [...completedPhases, currentPhase];
		}

		currentPhase = phase;

		// Update URL hash (use native API, wrapped in try-catch for safety during hydration)
		if (browser) {
			try {
				window.history.replaceState(window.history.state, '', `#${phase}`);
			} catch {
				// Ignore errors during hydration
			}
		}
	}

	function goNext() {
		const currentIndex = getPhaseIndex(currentPhase);
		if (currentIndex < PHASE_ORDER.length - 1) {
			goToPhase(PHASE_ORDER[currentIndex + 1]);
		}
	}

	function goBack() {
		const currentIndex = getPhaseIndex(currentPhase);
		if (currentIndex > 0) {
			goToPhase(PHASE_ORDER[currentIndex - 1]);
		}
	}

	// Seasonal date presets for analysis
	function setSeasonalDate(season: 'summer' | 'winter' | 'spring' | 'fall' | 'today') {
		const year = new Date().getFullYear();
		switch (season) {
			case 'summer':
				analysisDate = new Date(year, 5, 21); // June 21 - Summer Solstice
				break;
			case 'winter':
				analysisDate = new Date(year, 11, 21); // December 21 - Winter Solstice
				break;
			case 'spring':
				analysisDate = new Date(year, 2, 20); // March 20 - Spring Equinox
				break;
			case 'fall':
				analysisDate = new Date(year, 8, 22); // September 22 - Fall Equinox
				break;
			case 'today':
				analysisDate = new Date();
				break;
		}
	}

	// Next button labels by phase
	const nextLabels: Record<Phase, string> = {
		site: 'Confirm Site',
		analysis: 'Select Plants',
		plants: 'Review Plan',
		plan: 'Export'
	};

	// Pre-computed navigability for each phase (ensures reactivity in child components)
	const navigablePhases = $derived<Record<Phase, boolean>>({
		site: canAdvanceToPhase('site'),
		analysis: canAdvanceToPhase('analysis'),
		plants: canAdvanceToPhase('plants'),
		plan: canAdvanceToPhase('plan')
	});

	// Derived value for whether we can advance to the next phase (ensures reactivity)
	const canGoNextPhase = $derived.by(() => {
		const nextPhase = PHASE_ORDER[getPhaseIndex(currentPhase) + 1];
		if (!nextPhase) return false;
		return canAdvanceToPhase(nextPhase);
	});

	// Plan state persistence
	let isLoaded = $state(false);
	const debouncedSave = browser ? createDebouncedSave(500) : null;

	// Build current plan state for saving
	function buildPlanState(): StoredPlanState {
		// Convert DOY format to ISO date strings for storage
		const startDoy = analysisPeriod?.startDoy ?? 91; // April 1
		const endDoy = analysisPeriod?.endDoy ?? 304; // October 31
		const startDate = dayOfYearToDate(startDoy);
		const endDate = dayOfYearToDate(endDoy);

		// Map preset to storage type
		const typeMap: Record<string, 'growing-season' | 'full-year' | 'custom'> = {
			'growing-season': 'growing-season',
			'full-year': 'full-year'
		};
		const storageType = typeMap[analysisPeriod?.preset ?? 'custom'] ?? 'custom';

		return {
			version: 1,
			location: {
				lat: latitude,
				lng: longitude,
				name: name || ''
			},
			zones,
			currentPhase,
			completedPhases,
			analysisPeriod: {
				type: storageType,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			},
			preferences,
			obstacles,
			slope,
			lastModified: new Date().toISOString()
		};
	}

	// Restore state from stored plan
	function restorePlanState(state: StoredPlanState) {
		zones = state.zones;
		currentPhase = state.currentPhase;
		completedPhases = state.completedPhases;

		// Convert ISO date strings back to DOY format
		const startDate = new Date(state.analysisPeriod.startDate);
		const endDate = new Date(state.analysisPeriod.endDate);
		const startDoy = dateToDayOfYear(startDate);
		const endDoy = dateToDayOfYear(endDate);

		// Map storage type to preset
		const presetMap: Record<string, AnalysisPeriod['preset']> = {
			'growing-season': 'growing-season',
			'full-year': 'full-year',
			'custom': 'custom'
		};
		const preset = presetMap[state.analysisPeriod.type] ?? 'custom';

		// Generate label based on preset
		const labelMap: Record<string, string> = {
			'growing-season': 'Growing Season',
			'full-year': 'Full Year',
			'custom': 'Custom Period'
		};

		analysisPeriod = {
			preset,
			startDoy,
			endDoy,
			label: labelMap[preset] ?? 'Custom Period'
		};

		preferences = state.preferences;
		obstacles = state.obstacles;
		slope = state.slope;
	}

	// Clear plan and start fresh
	function handleClearPlan() {
		clearPlanState(latitude, longitude);
		zones = [];
		completedPhases = [];
		currentPhase = 'site';
		preferences = { ...DEFAULT_PREFERENCES };
		analysisPeriod = {
			startDate: new Date(new Date().getFullYear(), 3, 1),
			endDate: new Date(new Date().getFullYear(), 9, 31)
		};
	}

	// Handle continue from dialog
	function handleContinuePlan() {
		if (pendingPlanState) {
			restorePlanState(pendingPlanState);
		}
		pendingPlanState = null;
		showRestoreDialog = false;
		isLoaded = true;
	}

	// Handle start fresh from dialog
	function handleStartFresh() {
		pendingPlanState = null;
		showRestoreDialog = false;
		clearPlanState(latitude, longitude);
		isLoaded = true;
	}

	// Load saved state on mount
	$effect(() => {
		if (!browser) return;

		// Check for phase in URL hash
		const hash = window.location.hash.slice(1) as Phase;
		if (PHASE_ORDER.includes(hash)) {
			currentPhase = hash;
		}

		// Check for existing plan state
		const storedPlan = loadPlanState(latitude, longitude);
		if (storedPlan && storedPlan.zones.length > 0) {
			// Show restore dialog if there's meaningful saved data
			pendingPlanState = storedPlan;
			showRestoreDialog = true;
			// Apply URL hash phase if present
			if (hash && PHASE_ORDER.includes(hash)) {
				pendingPlanState = { ...storedPlan, currentPhase: hash };
			}
		} else if (storedPlan) {
			// No zones but some state exists - restore silently
			restorePlanState(storedPlan);
			if (hash && PHASE_ORDER.includes(hash)) {
				currentPhase = hash;
			}
			isLoaded = true;
		} else {
			// No saved state, start fresh
			isLoaded = true;
		}

		// Check for mobile viewport
		const checkMobile = () => {
			isMobile = window.innerWidth <= 768;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);

		// Listen for hash changes
		const handleHashChange = () => {
			const newHash = window.location.hash.slice(1) as Phase;
			if (PHASE_ORDER.includes(newHash) && newHash !== currentPhase) {
				goToPhase(newHash);
			}
		};
		window.addEventListener('hashchange', handleHashChange);

		return () => {
			window.removeEventListener('resize', checkMobile);
			window.removeEventListener('hashchange', handleHashChange);
			debouncedSave?.cancel();
		};
	});

	// Auto-save state on changes (debounced)
	$effect(() => {
		if (!isLoaded || !browser || !debouncedSave) return;

		// Track dependencies for auto-save
		const _ = [zones, currentPhase, completedPhases, analysisPeriod, preferences, obstacles, slope];

		debouncedSave.save(buildPlanState());
	});

	// Calculate shade-adjusted sun hours when obstacles are present
	const shadeAdjustedSunData = $derived.by(() => {
		if (obstacles.length === 0) {
			return null;
		}
		return getDailySunHoursWithShade(coords, new Date(), obstacles as Obstacle[]);
	});

	const effectiveSunHours = $derived(shadeAdjustedSunData?.effectiveHours ?? sunData.sunHours);

	// Enhanced climate data state (async)
	let enhancedClimateLoading = $state(true);
	let enhancedClimateError = $state<string | null>(null);
	let monthlyTemps = $state<MonthlyAverages | null>(null);
	let koppenClass = $state<KoppenClassification | null>(null);
	let seasonalOutlook = $state<CombinedOutlook | null>(null);
	let enhancedFrostDates = $state<FrostDates | null>(null);

	async function loadEnhancedClimate() {
		try {
			enhancedClimateLoading = true;
			enhancedClimateError = null;

			const [temps, outlook] = await Promise.all([
				fetchHistoricalTemperatures(coords, 30),
				getCompleteOutlook(coords)
			]);

			monthlyTemps = calculateMonthlyAverages(temps);
			enhancedFrostDates = calculateFrostDatesFromHistory(temps, latitude);
			seasonalOutlook = outlook;

			const precipPlaceholder = [80, 70, 60, 40, 20, 5, 2, 5, 15, 40, 60, 80];
			koppenClass = classifyKoppen({
				latitude,
				temps: monthlyTemps.avgTemps,
				precip: precipPlaceholder
			});
		} catch (err) {
			enhancedClimateError = err instanceof Error ? err.message : 'Failed to load climate data';
		} finally {
			enhancedClimateLoading = false;
		}
	}

	$effect(() => {
		loadEnhancedClimate();
	});

	const activeFrostDates: FrostDates = $derived(enhancedFrostDates ?? frostDates);

	const growingSeason: GrowingSeason = $derived.by(() => {
		const typicalLength = calculateGrowingSeasonLength(activeFrostDates);
		const shortLength = Math.max(
			0,
			activeFrostDates.firstFallFrost.early - activeFrostDates.lastSpringFrost.late
		);
		const longLength =
			activeFrostDates.firstFallFrost.late - activeFrostDates.lastSpringFrost.early;

		const lengthDays: GrowingSeasonRange = {
			short: shortLength,
			typical: typicalLength,
			long: longLength
		};

		return {
			lengthDays,
			frostFreePeriod: {
				start: activeFrostDates.lastSpringFrost,
				end: activeFrostDates.firstFallFrost
			},
			coolSeasonWindows: {
				spring: null,
				fall: null
			}
		};
	});

	function formatFrostDate(dayOfYear: number): string {
		const date = dayOfYearToDate(dayOfYear);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const climateData: ClimateData = $derived({
		frostDates: activeFrostDates,
		hardinessZone,
		growingSeason,
		fetchedAt: new Date()
	});

	const monthlyData: MonthlySunData[] = $derived.by(() => {
		const year = new Date().getFullYear();
		const yearSummaries = getYearlySummary(coords, year);

		return yearSummaries.map((summary, index) => {
			const month = index + 1;
			const theoreticalHours = summary.averageSunHours;

			if (obstacles.length === 0) {
				return { month, theoreticalHours, effectiveHours: theoreticalHours };
			}

			const startDate = new Date(year, index, 1);
			const endDate = new Date(year, index + 1, 0);
			const shadeAnalysis = getSeasonalSummaryWithShade(
				coords,
				startDate,
				endDate,
				obstacles as Obstacle[]
			);

			return {
				month,
				theoreticalHours,
				effectiveHours: shadeAnalysis.averageEffectiveHours
			};
		});
	});

	const recommendations = $derived.by(() => {
		const input = createRecommendationInput(effectiveSunHours, climateData, sunData.sunHours);
		return getRecommendations(input);
	});

	// PDF export handler
	async function handleExportPdf() {
		if (isExporting) return;

		isExporting = true;
		try {
			// Capture plan canvas image if available (legacy)
			let planImageDataUrl: string | undefined;
			if (planCanvasRef) {
				planImageDataUrl = await capturePlanImage(planCanvasRef);
			}

			// Capture seasonal shade analysis images if in analysis phase
			let seasonalShadeImages: SeasonalShadeImages | undefined;
			if (shadeMapInterface && shadeMapInterface.isAvailable() && mapRef) {
				console.log('Generating seasonal shade analysis images using buffered data...');

				// Store current state to restore later
				const originalDate = new Date(analysisDate);
				const currentZoom = mapRef.getZoom();

				// Use zoom 17-19 for optimal ShadeMap rendering (has buffered buildings, no quadtree issues)
				const captureZoom = currentZoom >= 16 && currentZoom <= 19 ? currentZoom : 18;
				if (currentZoom !== captureZoom) {
					mapRef.setZoom(captureZoom);
					// Brief wait for zoom animation
					await new Promise(resolve => setTimeout(resolve, 300));
				}

				// Helper to capture image for a season
				// Uses buffered building data - no tile reloading needed!
				const captureSeasonImage = async (season: 'summer' | 'winter' | 'spring' | 'fall'): Promise<string> => {
					console.log(`Capturing ${season}...`);

					// Set the seasonal date - ShadeMap recalculates using buffered buildings
					setSeasonalDate(season);

					// Brief wait for sun exposure recalculation (buildings already loaded)
					await new Promise(resolve => setTimeout(resolve, 400));

					// Capture the map image
					const imageUrl = await shadeMapInterface.captureMapImage();
					console.log(`  ${season}: ${imageUrl ? '✓' : '✗'}`);
					return imageUrl || '';
				};

				// Capture all four seasons quickly using buffered data
				const summer = await captureSeasonImage('summer');
				const winter = await captureSeasonImage('winter');
				const spring = await captureSeasonImage('spring');
				const fall = await captureSeasonImage('fall');

				seasonalShadeImages = { summer, winter, spring, fall };

				// Restore original state
				analysisDate = originalDate;
				if (currentZoom !== captureZoom) {
					mapRef.setZoom(currentZoom);
				}

				console.log('Seasonal shade analysis complete (total ~2 seconds)');
			}

			const exportData: PdfExportData = {
				location: {
					lat: latitude,
					lng: longitude,
					name: name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
				},
				analysisPeriod: {
					start: dayOfYearToDate(analysisPeriod.startDoy),
					end: dayOfYearToDate(analysisPeriod.endDoy)
				},
				zones,
				planImageDataUrl,
				seasonalShadeImages,
				generatedAt: new Date(),
				hardinessZone: `${hardinessZone.zone}${hardinessZone.subzone || ''}`,
				treeCount: plannerTrees.length
			};

			await generatePlanPdf(exportData);
		} catch (error) {
			console.error('PDF export failed:', error);
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Garden Plan - {name || 'Results'}</title>
</svelte:head>

{#if showRestoreDialog && pendingPlanState}
	<ContinuePlanDialog
		planState={pendingPlanState}
		oncontinue={handleContinuePlan}
		onstartfresh={handleStartFresh}
	/>
{/if}

<div class="plan-layout" class:mobile={isMobile}>
	<!-- Phase indicator at top -->
	<header class="layout-header">
		<PhaseIndicator
			{currentPhase}
			{completedPhases}
			onPhaseClick={goToPhase}
			{navigablePhases}
		/>
	</header>

	<!-- Main content area with map and panel -->
	<div class="layout-main">
		<!-- Map canvas (always visible) -->
		<div class="map-canvas">
			<!-- View toggle for plan phase -->
			{#if currentPhase === 'plan' || (currentPhase === 'plants' && zones.length > 0)}
				<div class="view-toggle-container">
					<ViewToggle bind:mode={viewMode} />
				</div>
			{/if}

			<!-- Map view -->
			{#if viewMode === 'map'}
				<MapPicker
					initialLocation={{ latitude, longitude }}
					zoom={20}
					showShadows={true}
					enableTreePlacement={currentPhase === 'site'}
					enableObservationPoint={currentPhase === 'analysis'}
					disableClickHandler={currentPhase === 'plants'}
					bind:trees={plannerTrees}
					bind:observationPoint
					shadowViewMode={currentPhase === 'site' ? 'shadows' : 'solar-hours'}
					date={currentPhase === 'analysis' ? analysisDate : undefined}
					{allowBuildingFetch}
					persistTrees={true}
					enableAutoTreeDetection={true}
					onmapready={(m) => (mapRef = m)}
					onshademaready={(sm) => (shadeMapInterface = sm)}
				/>
				{#if currentPhase === 'plants' && mapRef}
					<ZoneEditor
						bind:this={zoneEditorRef}
						map={mapRef}
						bind:zones
						{selectedZoneId}
						onselect={(id) => (selectedZoneId = id)}
						bind:drawingMode={zoneDrawingMode}
						ondrawingmodechange={(active) => (zoneDrawingMode = active)}
					/>
				{/if}
			{:else}
				<!-- Plan view -->
				<PlanCanvas
					{zones}
					onzoneschange={(z) => (zones = z)}
					{selectedZoneId}
					onselect={(id) => (selectedZoneId = id)}
					onsvgref={(svg) => (planCanvasRef = svg)}
				/>
			{/if}
		</div>

		<!-- Phase panel (sidebar on desktop, bottom sheet on mobile) -->
		{#if isMobile}
			{@const phaseLabels: Record<Phase, string> = {
				site: 'Site Setup',
				analysis: 'Sun Analysis',
				plants: 'Plant Selection',
				plan: 'Your Plan'
			}}
			{@const quickStats: Record<Phase, string> = {
				site: plannerTrees.length > 0 ? `${plannerTrees.length} trees` : '',
				analysis: observationPoint ? 'Spot selected' : '',
				plants: zones.length > 0 ? `${zones.length} zone${zones.length > 1 ? 's' : ''}` : '',
				plan: zones.reduce((sum, z) => sum + z.plants.reduce((pSum, p) => pSum + p.quantity, 0), 0) > 0
					? `${zones.reduce((sum, z) => sum + z.plants.reduce((pSum, p) => pSum + p.quantity, 0), 0)} plants`
					: ''
			}}
			<BottomSheet
				collapsedHeight="64px"
				minHeight="42%"
				maxHeight="75%"
				expanded={bottomSheetExpanded}
				title={phaseLabels[currentPhase]}
				quickStat={quickStats[currentPhase]}
				onExpand={() => (bottomSheetExpanded = true)}
				onCollapse={() => (bottomSheetExpanded = false)}
				onSwipeLeft={currentPhase !== 'plan' ? goNext : undefined}
				onSwipeRight={currentPhase !== 'site' ? goBack : undefined}
			>
				<PhasePanel
					{currentPhase}
					canGoNext={canGoNextPhase}
					nextLabel={nextLabels[currentPhase]}
					onNext={goNext}
					onBack={goBack}
				>
					{#if currentPhase === 'site'}
						{@render sitePhaseContent()}
					{:else if currentPhase === 'analysis'}
						{@render analysisPhaseContent()}
					{:else if currentPhase === 'plants'}
						{@render plantsPhaseContent()}
					{:else if currentPhase === 'plan'}
						{@render planPhaseContent()}
					{/if}
				</PhasePanel>
			</BottomSheet>
		{:else}
			<div class="panel-sidebar">
				<PhasePanel
					{currentPhase}
					canGoNext={canGoNextPhase}
					nextLabel={nextLabels[currentPhase]}
					onNext={goNext}
					onBack={goBack}
				>
					{#if currentPhase === 'site'}
						{@render sitePhaseContent()}
					{:else if currentPhase === 'analysis'}
						{@render analysisPhaseContent()}
					{:else if currentPhase === 'plants'}
						{@render plantsPhaseContent()}
					{:else if currentPhase === 'plan'}
						{@render planPhaseContent()}
					{/if}
				</PhasePanel>
			</div>
		{/if}
	</div>
</div>

<!-- Phase content snippets -->
{#snippet sitePhaseContent()}
	<div class="phase-content site-content">
		<section class="location-summary">
			{#if name}
				<h3 class="location-name">{name}</h3>
			{/if}
			<p class="location-coords">
				{latitude.toFixed(4)}, {longitude.toFixed(4)}
			</p>
			<p class="location-zone">
				Zone {hardinessZone.zone} · {formatZoneTempRange(hardinessZone)}
			</p>
		</section>

		<section class="site-status">
			<div class="status-item" class:complete={plannerTrees.length > 0 || true}>
				<span class="status-icon">✓</span>
				<span>Location confirmed</span>
			</div>
			<div class="status-item" class:complete={plannerTrees.length >= 0}>
				<span class="status-icon">{plannerTrees.length > 0 ? '✓' : '○'}</span>
				<span>Trees identified ({plannerTrees.length})</span>
			</div>
		</section>

		<section class="building-data-note">
			<p>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="16" x2="12" y2="12"/>
					<line x1="12" y1="8" x2="12.01" y2="8"/>
				</svg>
				Use the map controls to explore shadow patterns at different times and dates throughout the year. Building shadows load automatically when zoomed in (zoom 16+).
			</p>
		</section>

		<section class="tree-list">
			<h3>Trees on Property</h3>
			{#if plannerTrees.length === 0}
				<p class="empty-state">No trees detected. Auto-detection will find trees when you zoom in.</p>
			{:else}
				<details>
					<summary>{plannerTrees.length} tree{plannerTrees.length === 1 ? '' : 's'} detected</summary>
					<ul class="trees">
						{#each plannerTrees as tree}
							<li class="tree-item">
								<span class="tree-type">{tree.type}</span>
								<span class="tree-size">{tree.height}m tall · {tree.canopyWidth}m wide</span>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</section>

		{#if zones.length > 0 || completedPhases.length > 0}
			<section class="clear-section">
				<ClearPlanButton onclear={handleClearPlan} />
			</section>
		{/if}
	</div>
{/snippet}

{#snippet analysisPhaseContent()}
	<div class="phase-content analysis-content">
		<section class="period-section">
			<h3>Analysis Period</h3>
			<PeriodSelector
				bind:period={analysisPeriod}
				{latitude}
			/>
		</section>

		<section class="sun-summary">
			<h3>Sun Exposure</h3>
			<SunDataCard data={sunData} {timezone} />
		</section>

		<section class="analysis-info">
			<p>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="7" height="7"/>
					<rect x="14" y="3" width="7" height="7"/>
					<rect x="14" y="14" width="7" height="7"/>
					<rect x="3" y="14" width="7" height="7"/>
				</svg>
				The map shows a <strong>cumulative sun exposure heatmap</strong> (brighter = more sun hours). Place an observation point to get detailed sun hour calculations including tree shadow impact.
			</p>
		</section>

		{#if observationPoint && plannerSunHours}
			<section class="spot-results">
				<div class="spot-header">
					<h3>Selected Spot</h3>
					<div class="seasonal-presets">
						<button
							type="button"
							class="preset-btn"
							class:active={analysisDate.getMonth() === 5 && analysisDate.getDate() === 21}
							onclick={() => setSeasonalDate('summer')}
							title="Summer Solstice - Jun 21"
						>
							☀️ Summer
						</button>
						<button
							type="button"
							class="preset-btn"
							class:active={analysisDate.getMonth() === 11 && analysisDate.getDate() === 21}
							onclick={() => setSeasonalDate('winter')}
							title="Winter Solstice - Dec 21"
						>
							❄️ Winter
						</button>
						<button
							type="button"
							class="preset-btn"
							class:active={analysisDate.getMonth() === 2 && analysisDate.getDate() === 20}
							onclick={() => setSeasonalDate('spring')}
							title="Spring Equinox - Mar 20"
						>
							🌸 Spring
						</button>
						<button
							type="button"
							class="preset-btn"
							class:active={analysisDate.getMonth() === 8 && analysisDate.getDate() === 22}
							onclick={() => setSeasonalDate('fall')}
							title="Fall Equinox - Sep 22"
						>
							🍂 Fall
						</button>
						<button
							type="button"
							class="preset-btn"
							class:active={
								!(
									(analysisDate.getMonth() === 5 && analysisDate.getDate() === 21) ||
									(analysisDate.getMonth() === 11 && analysisDate.getDate() === 21) ||
									(analysisDate.getMonth() === 2 && analysisDate.getDate() === 20) ||
									(analysisDate.getMonth() === 8 && analysisDate.getDate() === 22)
								)
							}
							onclick={() => setSeasonalDate('today')}
							title="Today"
						>
							📅 Today
						</button>
					</div>
				</div>
				<SunHoursDisplay
					observationPoint={{ lat: observationPoint.lat, lng: observationPoint.lng }}
					trees={plannerTreeConfigs}
					date={analysisDate}
					{shadeMapInterface}
					shadowViewMode="solar-hours"
				/>
			</section>
		{:else}
			<section class="spot-prompt">
				<p>Click the crosshairs button, then click on the map to analyze sun exposure at a specific spot.</p>
			</section>
		{/if}

		<section class="climate-summary">
			<h3>Climate</h3>
			<div class="climate-cards">
				<div class="climate-card">
					<span class="card-label">Last Frost</span>
					<span class="card-value">{formatFrostDate(activeFrostDates.lastSpringFrost.median)}</span>
				</div>
				<div class="climate-card">
					<span class="card-label">First Frost</span>
					<span class="card-value">{formatFrostDate(activeFrostDates.firstFallFrost.median)}</span>
				</div>
				<div class="climate-card">
					<span class="card-label">Growing Season</span>
					<span class="card-value">{growingSeason.lengthDays.typical} days</span>
				</div>
			</div>
		</section>
	</div>
{/snippet}

{#snippet plantsPhaseContent()}
	<div class="phase-content plants-content">
		<section class="zones-section">
			<ZoneList
				{zones}
				{selectedZoneId}
				onselect={(id) => (selectedZoneId = id)}
				ondelete={(id) => zoneEditorRef?.deleteZone(id)}
				onrename={(id, name) => zoneEditorRef?.renameZone(id, name)}
				onaddzone={() => (zoneDrawingMode = !zoneDrawingMode)}
				drawingMode={zoneDrawingMode}
			/>
		</section>

		<section class="plant-selector-section">
			<PlantSelector
				{zones}
				{selectedZoneId}
				onzoneselect={(id) => (selectedZoneId = id)}
				onzoneplantschange={(zoneId, plants) => {
					zones = zones.map((z) => (z.id === zoneId ? { ...z, plants } : z));
				}}
			/>
		</section>
	</div>
{/snippet}

{#snippet planPhaseContent()}
	{@const totalPlants = zones.reduce((sum, z) => sum + z.plants.reduce((pSum, p) => pSum + p.quantity, 0), 0)}
	<div class="phase-content plan-content">
		<section class="plan-summary">
			<h3>Your Garden Plan</h3>
			<p class="plan-instructions">
				{#if viewMode === 'map'}
					Switch to Plan view to see your schematic layout. Drag plants to reposition them within zones.
				{:else}
					Drag plants to adjust positions. Yellow rings indicate spacing warnings; red rings indicate overlaps.
				{/if}
			</p>
		</section>

		<section class="plan-preview">
			<div class="plan-stats">
				<div class="stat">
					<span class="stat-value">{plannerTrees.length}</span>
					<span class="stat-label">Trees</span>
				</div>
				<div class="stat">
					<span class="stat-value">{zones.length}</span>
					<span class="stat-label">Zones</span>
				</div>
				<div class="stat">
					<span class="stat-value">{totalPlants}</span>
					<span class="stat-label">Plants</span>
				</div>
			</div>
		</section>

		<!-- Zone plant summary -->
		{#if zones.length > 0}
			<section class="zone-summary">
				<h3>Plant List by Zone</h3>
				{#each zones as zone}
					{@const zonePlantCount = zone.plants.reduce((sum, p) => sum + p.quantity, 0)}
					{#if zone.plants.length > 0}
						<div class="zone-plants">
							<div class="zone-header">
								<span class="zone-name">{zone.name}</span>
								<span class="zone-light">{zone.lightCategory.replace('-', ' ')}</span>
							</div>
							<ul class="plant-list">
								{#each zone.plants as placed}
									{@const plant = getPlantById(placed.plantId)}
									{#if plant}
										<li>
											<span class="plant-name">{plant.name}</span>
											<span class="plant-qty">x{placed.quantity}</span>
										</li>
									{/if}
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			</section>
		{/if}

		<section class="export-section">
			<button
				type="button"
				class="export-button"
				onclick={handleExportPdf}
				disabled={isExporting || zones.length === 0}
			>
				{#if isExporting}
					<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M21 12a9 9 0 1 1-6.219-8.56" />
					</svg>
					Generating...
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
					Generate PDF
				{/if}
			</button>
			{#if zones.length === 0}
				<p class="export-note">Add zones and plants first</p>
			{/if}
		</section>
	</div>
{/snippet}

<style>
	.plan-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: #f5f5f5;
	}

	.layout-header {
		flex-shrink: 0;
		z-index: 10;
	}

	.layout-main {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}

	/* Desktop layout: map left, panel right */
	.map-canvas {
		flex: 1;
		min-width: 0;
		position: relative;
	}

	.map-canvas :global(.map-container) {
		height: 100%;
	}

	.map-canvas :global(.plan-canvas) {
		height: 100%;
	}

	.view-toggle-container {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 1000;
	}

	.panel-sidebar {
		width: 35%;
		max-width: 420px;
		min-width: 320px;
		border-left: 1px solid #e5e7eb;
		overflow: hidden;
	}

	/* Mobile layout: map top, bottom sheet */
	.plan-layout.mobile .layout-main {
		flex-direction: column;
	}

	.plan-layout.mobile .map-canvas {
		flex: none;
		height: 60%;
	}

	.plan-layout.mobile .panel-sidebar {
		display: none;
	}

	/* Phase content styles */
	.phase-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.phase-content section {
		margin: 0;
	}

	.phase-content h3 {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	/* Site phase */
	.location-summary {
		padding: 1rem;
		background: #f0fdf4;
		border: 1px solid #86efac;
		border-radius: 8px;
	}

	.location-name {
		margin: 0 0 0.25rem !important;
		font-size: 1.125rem !important;
		font-weight: 600;
		color: #166534;
		text-transform: none !important;
		letter-spacing: normal !important;
	}

	.location-coords {
		margin: 0;
		font-size: 0.875rem;
		color: #4b5563;
		font-family: ui-monospace, monospace;
	}

	.location-zone {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: #15803d;
	}

	.tree-list details {
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		padding: 0.5rem;
		background: #fafafa;
	}

	.tree-list summary {
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: #166534;
		user-select: none;
		list-style: none;
	}

	.tree-list summary::-webkit-details-marker {
		display: none;
	}

	.tree-list summary::before {
		content: '▶';
		display: inline-block;
		margin-right: 0.5rem;
		transition: transform 0.2s;
	}

	.tree-list details[open] summary::before {
		transform: rotate(90deg);
	}

	.tree-list summary:hover {
		color: #15803d;
	}

	.tree-list .trees {
		list-style: none;
		margin: 0.5rem 0 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.tree-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.625rem 0.875rem;
		background: #fafafa;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
	}

	.tree-type {
		font-weight: 500;
		color: #1f2937;
		text-transform: capitalize;
	}

	.tree-size {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.empty-state {
		margin: 0;
		padding: 1rem;
		background: #f9fafb;
		border: 1px dashed #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #6b7280;
		text-align: center;
	}

	.site-status {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.status-item.complete {
		color: #15803d;
	}

	.status-icon {
		width: 1.25rem;
		text-align: center;
	}

	.clear-section {
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.building-data-note {
		margin-top: 1rem;
		padding: 0.75rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 6px;
	}

	.building-data-note p {
		margin: 0;
		font-size: 0.8125rem;
		color: #0369a1;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.building-data-note svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	/* Analysis phase */
	.analysis-info {
		padding: 0.75rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 6px;
		margin-bottom: 1rem;
	}

	.analysis-info p {
		margin: 0;
		font-size: 0.8125rem;
		color: #0369a1;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.analysis-info svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.climate-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	.climate-card {
		display: flex;
		flex-direction: column;
		padding: 0.75rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 6px;
		text-align: center;
	}

	.card-label {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		color: #3b82f6;
	}

	.card-value {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #1e40af;
	}

	.spot-prompt {
		padding: 1rem;
		background: #fefce8;
		border: 1px solid #fde047;
		border-radius: 6px;
	}

	.spot-prompt p {
		margin: 0;
		font-size: 0.875rem;
		color: #854d0e;
	}

	.spot-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.spot-header h3 {
		margin: 0;
	}

	.seasonal-presets {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.preset-btn {
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: #6b7280;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.preset-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.preset-btn.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
		font-weight: 600;
	}

	/* Plants phase */
	.placeholder-note {
		margin: 0;
		padding: 1rem;
		background: #f9fafb;
		border: 1px dashed #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Plan phase */
	.plan-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 8px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #0369a1;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #0284c7;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.export-section {
		text-align: center;
	}

	.export-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		background: #22c55e;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.export-button:hover:not(:disabled) {
		background: #16a34a;
	}

	.export-button:disabled {
		background: #d1d5db;
		cursor: not-allowed;
	}

	.export-note {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.plan-instructions {
		margin: 0;
		font-size: 0.875rem;
		color: #4b5563;
		line-height: 1.5;
	}

	.zone-summary {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.zone-plants {
		padding: 0.75rem;
		background: #fafafa;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
	}

	.zone-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.zone-name {
		font-weight: 600;
		color: #1f2937;
	}

	.zone-light {
		font-size: 0.75rem;
		text-transform: capitalize;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.plant-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.plant-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.plant-name {
		color: #374151;
	}

	.plant-qty {
		font-weight: 500;
		color: #6b7280;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.climate-cards {
			grid-template-columns: 1fr;
		}

		.plan-stats {
			grid-template-columns: repeat(3, 1fr);
			gap: 0.5rem;
		}

		.stat {
			padding: 0.75rem 0.5rem;
		}

		.stat-value {
			font-size: 1.25rem;
		}

		/* Better button sizing for mobile */
		.export-button {
			min-height: 48px;
			padding: 1rem 1.75rem;
			font-size: 1rem;
		}
	}

	/* Tablet (iPad) layout optimizations */
	@media (min-width: 769px) and (max-width: 1024px) {
		.plan-layout.mobile .map-canvas {
			height: 50%;
		}

		.panel-sidebar {
			width: 45%;
			max-width: 520px;
		}
	}

	/* iPad-specific touch optimizations */
	@media (min-width: 768px) and (max-width: 1024px) and (hover: none) {
		.phase-content h3 {
			font-size: 0.9375rem;
		}

		.location-summary {
			padding: 1.25rem;
		}

		.location-name {
			font-size: 1.25rem !important;
		}

		.location-coords {
			font-size: 0.9375rem;
		}

		.tree-item {
			min-height: 48px;
			padding: 0.75rem 1rem;
		}

		.tree-type {
			font-size: 1rem;
		}

		.tree-size {
			font-size: 0.875rem;
		}

		.climate-card {
			padding: 1rem;
		}

		.card-label {
			font-size: 0.75rem;
		}

		.card-value {
			font-size: 1.0625rem;
		}

		.stat {
			padding: 1.25rem;
		}

		.stat-value {
			font-size: 1.75rem;
		}

		.stat-label {
			font-size: 0.8125rem;
		}

		.export-button {
			min-height: 52px;
			padding: 1rem 2rem;
			font-size: 1.0625rem;
			border-radius: 10px;
		}

		.zone-plants {
			padding: 1rem;
		}

		.zone-name {
			font-size: 1rem;
		}

		.plant-list li {
			font-size: 0.9375rem;
			min-height: 36px;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.plan-layout {
			background: #e5e7eb;
		}

		.location-summary {
			border-width: 2px;
			background: #dcfce7;
		}

		.location-name {
			color: #052e16 !important;
		}

		.location-coords {
			color: #1f2937;
			font-weight: 600;
		}

		.location-zone {
			color: #166534;
			font-weight: 600;
		}

		.tree-item {
			border-width: 2px;
			background: #f3f4f6;
		}

		.tree-type {
			color: #000;
			font-weight: 700;
		}

		.tree-size {
			color: #374151;
			font-weight: 600;
		}

		.status-item {
			color: #374151;
			font-weight: 600;
		}

		.status-item.complete {
			color: #166534;
			font-weight: 700;
		}

		.climate-card {
			border-width: 2px;
			background: #dbeafe;
		}

		.card-label {
			color: #1d4ed8;
			font-weight: 700;
		}

		.card-value {
			color: #1e3a8a;
			font-weight: 800;
		}

		.spot-prompt {
			border-width: 2px;
		}

		.spot-prompt p {
			color: #78350f;
			font-weight: 600;
		}

		.stat {
			border-width: 2px;
			background: #dbeafe;
		}

		.stat-value {
			color: #0c4a6e;
			font-weight: 800;
		}

		.stat-label {
			color: #0369a1;
			font-weight: 700;
		}

		.export-button {
			background: #166534;
			font-weight: 700;
		}

		.export-button:hover:not(:disabled) {
			background: #15803d;
		}

		.export-button:disabled {
			background: #9ca3af;
		}

		.zone-plants {
			border-width: 2px;
		}

		.zone-header .zone-name {
			color: #000;
			font-weight: 700;
		}

		.zone-light {
			background: #d1d5db;
			color: #374151;
			font-weight: 600;
		}

		.plant-name {
			color: #000;
			font-weight: 600;
		}

		.plant-qty {
			color: #374151;
			font-weight: 700;
		}

		.plan-instructions {
			color: #1f2937;
			font-weight: 500;
		}

		.empty-state {
			border-width: 2px;
			color: #374151;
			font-weight: 500;
		}
	}
</style>
