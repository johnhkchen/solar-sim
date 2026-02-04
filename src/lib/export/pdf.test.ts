/**
 * Tests for PDF export functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF before importing the module
vi.mock('jspdf', () => {
	const MockJsPDF = vi.fn().mockImplementation(() => ({
		setProperties: vi.fn(),
		setFontSize: vi.fn(),
		setTextColor: vi.fn(),
		setFillColor: vi.fn(),
		setDrawColor: vi.fn(),
		setLineWidth: vi.fn(),
		text: vi.fn(),
		line: vi.fn(),
		rect: vi.fn(),
		roundedRect: vi.fn(),
		addPage: vi.fn(),
		addImage: vi.fn(),
		save: vi.fn(),
		getNumberOfPages: vi.fn().mockReturnValue(5),
		setPage: vi.fn(),
		splitTextToSize: vi.fn((text: string) => [text])
	}));
	return { jsPDF: MockJsPDF };
});

vi.mock('jspdf-autotable', () => ({
	default: vi.fn()
}));

// Mock plants module
vi.mock('$lib/plants', () => ({
	getPlantById: vi.fn((id: string) => {
		if (id === 'tomato') {
			return {
				id: 'tomato',
				name: 'Tomato',
				category: 'vegetable',
				description: 'Sun-loving vegetable for warm weather',
				light: {
					minSunHours: 6,
					toleratesAfternoonShade: false,
					benefitsFromAfternoonShade: false
				},
				temperature: {
					frostTolerance: 'tender',
					minGrowingTempF: 50,
					maxGrowingTempF: 95,
					optimalMinTempF: 65,
					optimalMaxTempF: 85
				},
				timing: {
					daysToMaturityMin: 60,
					daysToMaturityMax: 90,
					canStartIndoors: true,
					weeksToStartIndoors: 6
				}
			};
		}
		if (id === 'lettuce') {
			return {
				id: 'lettuce',
				name: 'Lettuce',
				category: 'vegetable',
				description: 'Cool-season leafy green',
				light: {
					minSunHours: 3,
					toleratesAfternoonShade: true,
					benefitsFromAfternoonShade: true
				},
				temperature: {
					frostTolerance: 'semi-hardy',
					minGrowingTempF: 35,
					maxGrowingTempF: 75,
					optimalMinTempF: 50,
					optimalMaxTempF: 65
				},
				timing: {
					daysToMaturityMin: 30,
					daysToMaturityMax: 60,
					canStartIndoors: true,
					weeksToStartIndoors: 4
				}
			};
		}
		return null;
	})
}));

import { generatePlanPdf, type PdfExportData } from './pdf.js';
import type { Zone } from '$lib/components/ZoneEditor.svelte';

describe('PDF Export', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('generatePlanPdf', () => {
		const createTestData = (zones: Zone[]): PdfExportData => ({
			location: {
				lat: 37.7749,
				lng: -122.4194,
				name: 'San Francisco, CA'
			},
			analysisPeriod: {
				start: new Date(2026, 3, 1),
				end: new Date(2026, 9, 31)
			},
			zones,
			generatedAt: new Date(2026, 0, 31),
			hardinessZone: '10a',
			treeCount: 2
		});

		it('generates PDF with empty zones', async () => {
			const data = createTestData([]);

			await expect(generatePlanPdf(data)).resolves.not.toThrow();
		});

		it('generates PDF with zones and plants', async () => {
			const zones: Zone[] = [
				{
					id: 'zone-1',
					name: 'Bed A',
					bounds: { north: 37.776, south: 37.775, east: -122.418, west: -122.42 },
					avgSunHours: 7.5,
					lightCategory: 'full-sun',
					plants: [
						{
							plantId: 'tomato',
							quantity: 4,
							positions: [
								{ lat: 37.7755, lng: -122.419 },
								{ lat: 37.7755, lng: -122.4185 },
								{ lat: 37.7755, lng: -122.418 },
								{ lat: 37.7755, lng: -122.4175 }
							]
						}
					]
				},
				{
					id: 'zone-2',
					name: 'Bed B',
					bounds: { north: 37.774, south: 37.773, east: -122.418, west: -122.42 },
					avgSunHours: 3.5,
					lightCategory: 'part-shade',
					plants: [
						{
							plantId: 'lettuce',
							quantity: 6,
							positions: [
								{ lat: 37.7735, lng: -122.419 },
								{ lat: 37.7735, lng: -122.4185 },
								{ lat: 37.7735, lng: -122.418 },
								{ lat: 37.7735, lng: -122.4175 },
								{ lat: 37.7735, lng: -122.417 },
								{ lat: 37.7735, lng: -122.4165 }
							]
						}
					]
				}
			];

			const data = createTestData(zones);

			await expect(generatePlanPdf(data)).resolves.not.toThrow();
		});

		it('generates PDF with plan image', async () => {
			const zones: Zone[] = [
				{
					id: 'zone-1',
					name: 'Bed A',
					bounds: { north: 37.776, south: 37.775, east: -122.418, west: -122.42 },
					avgSunHours: 6.2,
					lightCategory: 'full-sun',
					plants: []
				}
			];

			const data = createTestData(zones);
			data.planImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...';

			await expect(generatePlanPdf(data)).resolves.not.toThrow();
		});

		it('handles multiple zones with same plant', async () => {
			const zones: Zone[] = [
				{
					id: 'zone-1',
					name: 'Bed A',
					bounds: { north: 37.776, south: 37.775, east: -122.418, west: -122.42 },
					avgSunHours: 7.5,
					lightCategory: 'full-sun',
					plants: [{ plantId: 'tomato', quantity: 2, positions: [] }]
				},
				{
					id: 'zone-2',
					name: 'Bed B',
					bounds: { north: 37.774, south: 37.773, east: -122.418, west: -122.42 },
					avgSunHours: 6.5,
					lightCategory: 'full-sun',
					plants: [{ plantId: 'tomato', quantity: 3, positions: [] }]
				}
			];

			const data = createTestData(zones);

			// Should aggregate tomato across zones (total qty: 5)
			await expect(generatePlanPdf(data)).resolves.not.toThrow();
		});

		it('generates sensible filename from location', async () => {
			const { jsPDF } = await import('jspdf');
			const data = createTestData([]);
			data.location.name = '123 Main Street, Springfield';

			await generatePlanPdf(data);

			const mockInstance = (jsPDF as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
			expect(mockInstance.save).toHaveBeenCalledWith(
				expect.stringContaining('planting-plan-123-main-street')
			);
		});

		it('generates filename from coordinates when name missing', async () => {
			const { jsPDF } = await import('jspdf');
			const data = createTestData([]);
			data.location.name = '';

			await generatePlanPdf(data);

			const mockInstance = (jsPDF as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
			expect(mockInstance.save).toHaveBeenCalledWith(
				expect.stringContaining('planting-plan-37.77')
			);
		});
	});
});
