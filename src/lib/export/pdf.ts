/**
 * PDF export module for Solar-Sim planting plans.
 *
 * Generates a professional planting plan PDF with cover page, overhead plan,
 * plant schedule, zone details, and growing notes. Uses jsPDF for client-side
 * PDF generation with no server required.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Zone, PlacedPlant } from '$lib/components/ZoneEditor.svelte';
import { calculateZoneArea, formatArea, LIGHT_COLORS } from '$lib/components/ZoneEditor.svelte';
import { getPlantById, type Plant } from '$lib/plants';

// Constants for layout
const PAGE_WIDTH = 215.9; // Letter width in mm
const PAGE_HEIGHT = 279.4; // Letter height in mm
const MARGIN = 12.7; // 0.5 inch margin
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Colors (RGB arrays for jsPDF)
const COLORS = {
	primary: [34, 197, 94] as [number, number, number], // green-500
	secondary: [59, 130, 246] as [number, number, number], // blue-500
	text: [31, 41, 55] as [number, number, number], // gray-800
	textLight: [107, 114, 128] as [number, number, number], // gray-500
	border: [229, 231, 235] as [number, number, number], // gray-200
	lightBg: [249, 250, 251] as [number, number, number] // gray-50
};

/**
 * Data required for PDF export.
 */
export interface PdfExportData {
	location: {
		lat: number;
		lng: number;
		name: string;
		address?: string;
	};
	analysisPeriod: {
		start: Date;
		end: Date;
	};
	zones: Zone[];
	planImageDataUrl?: string;
	generatedAt: Date;
	hardinessZone?: string;
	treeCount?: number;
}

/**
 * Plant schedule entry for the table.
 */
interface PlantScheduleEntry {
	code: string;
	commonName: string;
	botanicalName: string;
	quantity: number;
	daysToMaturity: string;
	lightRequirement: string;
	zones: string[];
}

/**
 * Generates a two-letter code for a plant name.
 */
function generateCode(name: string, existingCodes: Set<string>): string {
	// Try first two letters
	let code = name.substring(0, 2).toUpperCase();
	if (!existingCodes.has(code)) {
		existingCodes.add(code);
		return code;
	}

	// Try first letter + second word's first letter
	const words = name.split(/\s+/);
	if (words.length > 1) {
		code = (words[0][0] + words[1][0]).toUpperCase();
		if (!existingCodes.has(code)) {
			existingCodes.add(code);
			return code;
		}
	}

	// Try consonants
	const consonants = name.replace(/[aeiou\s]/gi, '').substring(0, 2).toUpperCase();
	if (consonants.length === 2 && !existingCodes.has(consonants)) {
		existingCodes.add(consonants);
		return consonants;
	}

	// Fallback: append number
	let counter = 1;
	while (existingCodes.has(`${code}${counter}`)) {
		counter++;
	}
	const finalCode = `${code}${counter}`;
	existingCodes.add(finalCode);
	return finalCode;
}

/**
 * Formats a date for display.
 */
function formatDate(date: Date): string {
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/**
 * Formats the analysis period for display.
 */
function formatPeriod(start: Date, end: Date): string {
	const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	return `${startMonth} - ${endMonth}`;
}

/**
 * Builds the plant schedule from zones.
 */
function buildPlantSchedule(zones: Zone[]): PlantScheduleEntry[] {
	const plantMap = new Map<
		string,
		{ plant: Plant; quantity: number; zones: string[] }
	>();

	// Aggregate plants across zones
	for (const zone of zones) {
		for (const placed of zone.plants) {
			const plant = getPlantById(placed.plantId);
			if (!plant) continue;

			const existing = plantMap.get(placed.plantId);
			if (existing) {
				existing.quantity += placed.quantity;
				if (!existing.zones.includes(zone.name)) {
					existing.zones.push(zone.name);
				}
			} else {
				plantMap.set(placed.plantId, {
					plant,
					quantity: placed.quantity,
					zones: [zone.name]
				});
			}
		}
	}

	// Convert to schedule entries with codes
	const existingCodes = new Set<string>();
	const entries: PlantScheduleEntry[] = [];

	for (const { plant, quantity, zones } of plantMap.values()) {
		const code = generateCode(plant.name, existingCodes);
		const minHours = plant.light.minSunHours;
		const lightReq =
			minHours >= 6 ? 'Full Sun' : minHours >= 4 ? 'Part Sun' : minHours >= 2 ? 'Part Shade' : 'Shade';

		entries.push({
			code,
			commonName: plant.name,
			botanicalName: plant.description.split('.')[0] || '', // Use first sentence as botanical placeholder
			quantity,
			daysToMaturity: `${plant.timing.daysToMaturityMin}-${plant.timing.daysToMaturityMax}`,
			lightRequirement: lightReq,
			zones: zones.sort()
		});
	}

	// Sort by zone, then alphabetically
	entries.sort((a, b) => {
		const zoneCompare = a.zones[0].localeCompare(b.zones[0]);
		if (zoneCompare !== 0) return zoneCompare;
		return a.commonName.localeCompare(b.commonName);
	});

	return entries;
}

/**
 * Calculates summary statistics from zones.
 */
function calculateStats(zones: Zone[]): {
	totalArea: number;
	zoneCount: number;
	speciesCount: number;
	plantCount: number;
	lightSummary: string;
} {
	let totalArea = 0;
	const speciesSet = new Set<string>();
	let plantCount = 0;
	const lightCounts: Record<string, number> = {};

	for (const zone of zones) {
		totalArea += calculateZoneArea(zone.bounds);
		lightCounts[zone.lightCategory] = (lightCounts[zone.lightCategory] || 0) + 1;

		for (const placed of zone.plants) {
			speciesSet.add(placed.plantId);
			plantCount += placed.quantity;
		}
	}

	// Build light summary
	const lightParts: string[] = [];
	const lightLabels: Record<string, string> = {
		'full-sun': 'full sun',
		'part-sun': 'part sun',
		'part-shade': 'part shade',
		'full-shade': 'full shade'
	};

	for (const [category, count] of Object.entries(lightCounts)) {
		lightParts.push(`${count} ${lightLabels[category]} bed${count > 1 ? 's' : ''}`);
	}

	return {
		totalArea,
		zoneCount: zones.length,
		speciesCount: speciesSet.size,
		plantCount,
		lightSummary: lightParts.join(', ')
	};
}

/**
 * Adds the cover page to the PDF.
 */
function addCoverPage(doc: jsPDF, data: PdfExportData): void {
	const stats = calculateStats(data.zones);
	let y = MARGIN + 20;

	// Title
	doc.setFontSize(28);
	doc.setTextColor(...COLORS.primary);
	doc.text('Planting Plan', PAGE_WIDTH / 2, y, { align: 'center' });
	y += 20;

	// Location name
	if (data.location.name) {
		doc.setFontSize(16);
		doc.setTextColor(...COLORS.text);
		doc.text(data.location.name, PAGE_WIDTH / 2, y, { align: 'center' });
		y += 8;
	}

	// Coordinates
	doc.setFontSize(10);
	doc.setTextColor(...COLORS.textLight);
	doc.text(
		`${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`,
		PAGE_WIDTH / 2,
		y,
		{ align: 'center' }
	);
	y += 6;

	// Address if available
	if (data.location.address) {
		doc.text(data.location.address, PAGE_WIDTH / 2, y, { align: 'center' });
		y += 6;
	}

	// Date generated
	doc.text(`Generated: ${formatDate(data.generatedAt)}`, PAGE_WIDTH / 2, y, { align: 'center' });
	y += 20;

	// Divider
	doc.setDrawColor(...COLORS.border);
	doc.setLineWidth(0.5);
	doc.line(MARGIN + 40, y, PAGE_WIDTH - MARGIN - 40, y);
	y += 20;

	// Analysis period box
	doc.setFillColor(...COLORS.lightBg);
	doc.roundedRect(MARGIN + 20, y, CONTENT_WIDTH - 40, 25, 3, 3, 'F');

	doc.setFontSize(10);
	doc.setTextColor(...COLORS.textLight);
	doc.text('ANALYSIS PERIOD', PAGE_WIDTH / 2, y + 8, { align: 'center' });

	doc.setFontSize(14);
	doc.setTextColor(...COLORS.text);
	doc.text(
		formatPeriod(data.analysisPeriod.start, data.analysisPeriod.end),
		PAGE_WIDTH / 2,
		y + 18,
		{ align: 'center' }
	);
	y += 40;

	// Summary stats grid
	const statBoxWidth = (CONTENT_WIDTH - 30) / 4;
	const statBoxHeight = 35;
	const statsData = [
		{ label: 'Total Area', value: formatArea(stats.totalArea) },
		{ label: 'Zones', value: stats.zoneCount.toString() },
		{ label: 'Species', value: stats.speciesCount.toString() },
		{ label: 'Plants', value: stats.plantCount.toString() }
	];

	for (let i = 0; i < 4; i++) {
		const x = MARGIN + 10 + i * (statBoxWidth + 10);
		doc.setFillColor(...COLORS.lightBg);
		doc.roundedRect(x, y, statBoxWidth, statBoxHeight, 3, 3, 'F');

		doc.setFontSize(8);
		doc.setTextColor(...COLORS.textLight);
		doc.text(statsData[i].label.toUpperCase(), x + statBoxWidth / 2, y + 10, { align: 'center' });

		doc.setFontSize(16);
		doc.setTextColor(...COLORS.text);
		doc.text(statsData[i].value, x + statBoxWidth / 2, y + 25, { align: 'center' });
	}
	y += statBoxHeight + 20;

	// Light summary
	if (stats.lightSummary) {
		doc.setFontSize(12);
		doc.setTextColor(...COLORS.text);
		doc.text('Light Conditions:', PAGE_WIDTH / 2, y, { align: 'center' });
		y += 8;
		doc.setFontSize(11);
		doc.setTextColor(...COLORS.textLight);
		doc.text(stats.lightSummary, PAGE_WIDTH / 2, y, { align: 'center' });
		y += 15;
	}

	// Hardiness zone if available
	if (data.hardinessZone) {
		doc.setFontSize(11);
		doc.setTextColor(...COLORS.textLight);
		doc.text(`USDA Hardiness Zone: ${data.hardinessZone}`, PAGE_WIDTH / 2, y, { align: 'center' });
		y += 15;
	}

	// Tree count if available
	if (data.treeCount !== undefined && data.treeCount > 0) {
		doc.setFontSize(11);
		doc.setTextColor(...COLORS.textLight);
		doc.text(
			`Trees on Property: ${data.treeCount}`,
			PAGE_WIDTH / 2,
			y,
			{ align: 'center' }
		);
	}
}

/**
 * Adds the overhead plan page to the PDF.
 */
function addPlanPage(doc: jsPDF, data: PdfExportData, schedule: PlantScheduleEntry[]): void {
	doc.addPage();
	let y = MARGIN;

	// Page title
	doc.setFontSize(18);
	doc.setTextColor(...COLORS.text);
	doc.text('Overhead Plan', MARGIN, y + 10);
	y += 20;

	// Plan image if available
	if (data.planImageDataUrl) {
		const imgWidth = CONTENT_WIDTH;
		const imgHeight = 120; // Fixed height for plan image
		doc.addImage(data.planImageDataUrl, 'PNG', MARGIN, y, imgWidth, imgHeight);
		y += imgHeight + 10;
	} else {
		// Placeholder for plan image
		doc.setFillColor(...COLORS.lightBg);
		doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 120, 3, 3, 'F');
		doc.setFontSize(12);
		doc.setTextColor(...COLORS.textLight);
		doc.text('Plan view not available', PAGE_WIDTH / 2, y + 60, { align: 'center' });
		y += 130;
	}

	// Legend
	doc.setFontSize(12);
	doc.setTextColor(...COLORS.text);
	doc.text('Legend', MARGIN, y + 5);
	y += 12;

	// Light category legend
	const lightCategories: { key: Zone['lightCategory']; label: string }[] = [
		{ key: 'full-sun', label: 'Full Sun (6+ hrs)' },
		{ key: 'part-sun', label: 'Part Sun (4-6 hrs)' },
		{ key: 'part-shade', label: 'Part Shade (2-4 hrs)' },
		{ key: 'full-shade', label: 'Full Shade (<2 hrs)' }
	];

	const legendItemWidth = (CONTENT_WIDTH - 15) / 4;
	for (let i = 0; i < lightCategories.length; i++) {
		const x = MARGIN + i * (legendItemWidth + 5);
		const color = LIGHT_COLORS[lightCategories[i].key];
		const rgb = hexToRgb(color);

		doc.setFillColor(rgb.r, rgb.g, rgb.b);
		doc.rect(x, y, 10, 6, 'F');

		doc.setFontSize(8);
		doc.setTextColor(...COLORS.textLight);
		doc.text(lightCategories[i].label, x + 12, y + 5);
	}
	y += 15;

	// Plant codes legend (if space permits)
	if (schedule.length > 0 && y < PAGE_HEIGHT - 80) {
		doc.setFontSize(10);
		doc.setTextColor(...COLORS.text);
		doc.text('Plant Codes', MARGIN, y + 5);
		y += 10;

		const codesPerRow = 4;
		const codeWidth = CONTENT_WIDTH / codesPerRow;
		let col = 0;
		let startY = y;

		for (const entry of schedule.slice(0, 12)) {
			// Limit to 12 to fit
			const x = MARGIN + col * codeWidth;
			doc.setFontSize(8);
			doc.setTextColor(...COLORS.text);
			doc.text(`${entry.code}:`, x, y + 5);
			doc.setTextColor(...COLORS.textLight);
			doc.text(entry.commonName, x + 10, y + 5);

			col++;
			if (col >= codesPerRow) {
				col = 0;
				y += 7;
			}
		}
		if (col !== 0) y += 7;

		if (schedule.length > 12) {
			doc.setFontSize(8);
			doc.setTextColor(...COLORS.textLight);
			doc.text(`...and ${schedule.length - 12} more (see Plant Schedule)`, MARGIN, y + 5);
		}
	}
}

/**
 * Adds the plant schedule page(s) to the PDF.
 */
function addPlantSchedulePage(doc: jsPDF, schedule: PlantScheduleEntry[]): void {
	if (schedule.length === 0) return;

	doc.addPage();
	let y = MARGIN;

	// Page title
	doc.setFontSize(18);
	doc.setTextColor(...COLORS.text);
	doc.text('Plant Schedule', MARGIN, y + 10);
	y += 15;

	// Build table data
	const tableHead = [['Code', 'Common Name', 'Description', 'Qty', 'Days to Harvest', 'Light', 'Zone(s)']];
	const tableBody = schedule.map((entry) => [
		entry.code,
		entry.commonName,
		entry.botanicalName.length > 40
			? entry.botanicalName.substring(0, 37) + '...'
			: entry.botanicalName,
		entry.quantity.toString(),
		entry.daysToMaturity,
		entry.lightRequirement,
		entry.zones.join(', ')
	]);

	autoTable(doc, {
		head: tableHead,
		body: tableBody,
		startY: y,
		margin: { left: MARGIN, right: MARGIN },
		styles: {
			fontSize: 9,
			cellPadding: 3,
			textColor: COLORS.text,
			lineColor: COLORS.border,
			lineWidth: 0.1
		},
		headStyles: {
			fillColor: COLORS.primary,
			textColor: [255, 255, 255],
			fontStyle: 'bold',
			fontSize: 9
		},
		alternateRowStyles: {
			fillColor: COLORS.lightBg
		},
		columnStyles: {
			0: { cellWidth: 15 }, // Code
			1: { cellWidth: 35 }, // Common Name
			2: { cellWidth: 50 }, // Description
			3: { cellWidth: 15, halign: 'center' }, // Qty
			4: { cellWidth: 25, halign: 'center' }, // Days
			5: { cellWidth: 25 }, // Light
			6: { cellWidth: 25 } // Zone(s)
		}
	});
}

/**
 * Adds zone details page(s) to the PDF.
 */
function addZoneDetailsPage(doc: jsPDF, zones: Zone[]): void {
	if (zones.length === 0) return;

	doc.addPage();
	let y = MARGIN;

	// Page title
	doc.setFontSize(18);
	doc.setTextColor(...COLORS.text);
	doc.text('Zone Details', MARGIN, y + 10);
	y += 20;

	for (const zone of zones) {
		// Check if we need a new page
		if (y > PAGE_HEIGHT - 60) {
			doc.addPage();
			y = MARGIN;
		}

		const area = calculateZoneArea(zone.bounds);
		const plantCount = zone.plants.reduce((sum, p) => sum + p.quantity, 0);
		const color = LIGHT_COLORS[zone.lightCategory];
		const rgb = hexToRgb(color);

		// Zone header with color bar
		doc.setFillColor(rgb.r, rgb.g, rgb.b);
		doc.rect(MARGIN, y, 4, 20, 'F');

		doc.setFontSize(14);
		doc.setTextColor(...COLORS.text);
		doc.text(zone.name, MARGIN + 8, y + 7);

		doc.setFontSize(10);
		doc.setTextColor(...COLORS.textLight);
		const lightLabel = zone.lightCategory.replace('-', ' ');
		doc.text(
			`${lightLabel} | ${zone.avgSunHours.toFixed(1)} hrs/day | ${formatArea(area)}`,
			MARGIN + 8,
			y + 16
		);
		y += 25;

		// Plants in zone
		if (zone.plants.length > 0) {
			doc.setFontSize(9);
			doc.setTextColor(...COLORS.text);

			for (const placed of zone.plants) {
				const plant = getPlantById(placed.plantId);
				if (!plant) continue;

				doc.text(`\u2022 ${plant.name} x${placed.quantity}`, MARGIN + 10, y);
				y += 6;
			}
		} else {
			doc.setFontSize(9);
			doc.setTextColor(...COLORS.textLight);
			doc.text('No plants added', MARGIN + 10, y);
			y += 6;
		}

		y += 10;
	}
}

/**
 * Adds the growing notes page to the PDF.
 */
function addGrowingNotesPage(doc: jsPDF, zones: Zone[]): void {
	doc.addPage();
	let y = MARGIN;

	// Page title
	doc.setFontSize(18);
	doc.setTextColor(...COLORS.text);
	doc.text('Growing Notes', MARGIN, y + 10);
	y += 20;

	// General care guidance
	doc.setFontSize(12);
	doc.setTextColor(...COLORS.text);
	doc.text('General Care', MARGIN, y);
	y += 8;

	doc.setFontSize(10);
	doc.setTextColor(...COLORS.textLight);
	const generalNotes = [
		'Water deeply but infrequently to encourage deep root growth.',
		'Mulch around plants to retain moisture and suppress weeds.',
		'Monitor for pests and diseases, especially during humid weather.',
		'Fertilize according to each plant\'s specific needs.',
		'Rotate annual crops each year to prevent soil depletion.'
	];

	for (const note of generalNotes) {
		const lines = doc.splitTextToSize(`\u2022 ${note}`, CONTENT_WIDTH - 10);
		for (const line of lines) {
			doc.text(line, MARGIN + 5, y);
			y += 5;
		}
		y += 2;
	}
	y += 10;

	// Zone-specific notes based on light category
	const hasFullSun = zones.some((z) => z.lightCategory === 'full-sun');
	const hasShade = zones.some((z) => z.lightCategory === 'part-shade' || z.lightCategory === 'full-shade');

	if (hasFullSun) {
		doc.setFontSize(12);
		doc.setTextColor(...COLORS.text);
		doc.text('Full Sun Areas', MARGIN, y);
		y += 8;

		doc.setFontSize(10);
		doc.setTextColor(...COLORS.textLight);
		const sunNotes = [
			'Water more frequently during hot spells.',
			'Consider afternoon shade cloth for heat-sensitive plants in summer.',
			'Full sun beds are ideal for tomatoes, peppers, and most herbs.'
		];

		for (const note of sunNotes) {
			doc.text(`\u2022 ${note}`, MARGIN + 5, y);
			y += 6;
		}
		y += 10;
	}

	if (hasShade) {
		doc.setFontSize(12);
		doc.setTextColor(...COLORS.text);
		doc.text('Shaded Areas', MARGIN, y);
		y += 8;

		doc.setFontSize(10);
		doc.setTextColor(...COLORS.textLight);
		const shadeNotes = [
			'Shaded areas retain moisture longer; avoid overwatering.',
			'Excellent for leafy greens that bolt in full sun.',
			'Consider pruning tree canopies to increase light if needed.'
		];

		for (const note of shadeNotes) {
			doc.text(`\u2022 ${note}`, MARGIN + 5, y);
			y += 6;
		}
		y += 10;
	}

	// Seasonal maintenance
	doc.setFontSize(12);
	doc.setTextColor(...COLORS.text);
	doc.text('Seasonal Maintenance', MARGIN, y);
	y += 8;

	doc.setFontSize(10);
	doc.setTextColor(...COLORS.textLight);
	const seasonalNotes = [
		'Spring: Prepare beds, add compost, plant cool-season crops.',
		'Summer: Maintain watering, harvest regularly, succession plant.',
		'Fall: Plant cool-season crops, prepare beds for winter.',
		'Winter: Plan next season, order seeds, maintain tools.'
	];

	for (const note of seasonalNotes) {
		doc.text(`\u2022 ${note}`, MARGIN + 5, y);
		y += 6;
	}

	// Footer
	y = PAGE_HEIGHT - MARGIN - 10;
	doc.setFontSize(9);
	doc.setTextColor(...COLORS.textLight);
	doc.text('Generated by Solar-Sim', PAGE_WIDTH / 2, y, { align: 'center' });
}

/**
 * Converts hex color to RGB object.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
			}
		: { r: 0, g: 0, b: 0 };
}

/**
 * Generates a sensible filename for the PDF.
 */
function generateFilename(data: PdfExportData): string {
	const locationPart = data.location.name
		? data.location.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '')
				.substring(0, 30)
		: `${data.location.lat.toFixed(2)}-${data.location.lng.toFixed(2)}`;

	return `planting-plan-${locationPart}.pdf`;
}

/**
 * Generates a planting plan PDF and triggers download.
 *
 * @param data - The export data including location, zones, and plan image
 * @returns Promise that resolves when the PDF is generated and download triggered
 */
export async function generatePlanPdf(data: PdfExportData): Promise<void> {
	// Create PDF document
	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'letter'
	});

	// Set document metadata
	doc.setProperties({
		title: `Planting Plan - ${data.location.name || 'Garden'}`,
		subject: 'Garden planting plan generated by Solar-Sim',
		creator: 'Solar-Sim',
		author: 'Solar-Sim'
	});

	// Build plant schedule
	const schedule = buildPlantSchedule(data.zones);

	// Add pages
	addCoverPage(doc, data);
	addPlanPage(doc, data, schedule);
	addPlantSchedulePage(doc, schedule);
	addZoneDetailsPage(doc, data.zones);
	addGrowingNotesPage(doc, data.zones);

	// Add page numbers
	const pageCount = doc.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setTextColor(...COLORS.textLight);
		doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 5, { align: 'center' });
	}

	// Generate filename and save
	const filename = generateFilename(data);
	doc.save(filename);
}

/**
 * Captures the plan canvas as a data URL for embedding in the PDF.
 *
 * @param canvasElement - The SVG or canvas element to capture
 * @returns Promise resolving to a data URL, or undefined if capture fails
 */
export async function capturePlanImage(canvasElement: SVGSVGElement | HTMLCanvasElement): Promise<string | undefined> {
	try {
		if (canvasElement instanceof HTMLCanvasElement) {
			return canvasElement.toDataURL('image/png');
		}

		// For SVG, convert to canvas first
		const svg = canvasElement;
		const svgData = new XMLSerializer().serializeToString(svg);
		const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const scale = 2; // 2x for better quality
				canvas.width = svg.clientWidth * scale;
				canvas.height = svg.clientHeight * scale;

				const ctx = canvas.getContext('2d');
				if (!ctx) {
					URL.revokeObjectURL(url);
					resolve(undefined);
					return;
				}

				ctx.scale(scale, scale);
				ctx.drawImage(img, 0, 0);
				URL.revokeObjectURL(url);
				resolve(canvas.toDataURL('image/png'));
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				resolve(undefined);
			};
			img.src = url;
		});
	} catch {
		return undefined;
	}
}
