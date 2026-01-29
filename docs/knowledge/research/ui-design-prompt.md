# UI Design Prompt for Solar-Sim

This document provides a comprehensive design brief for generating wireframes and mockups of Solar-Sim, a webapp that helps gardeners understand sun exposure at any location and receive personalized plant recommendations.

---

## App Overview

Solar-Sim helps home gardeners answer the question "What can I grow here?" by calculating sun hours for any location on Earth and translating that data into actionable planting guidance. The target user is someone like Maria, a home gardener in Portland, Oregon who knows tomatoes need "full sun" but doesn't know if her backyard actually gets 6+ hours of direct sunlight or how that changes across the growing season.

The app differentiates from existing tools by focusing on the gardener's question rather than raw astronomical data. It requires no accounts, works on any device, and gives answers in plant terms rather than degrees and radians. Users should get meaningful data within seconds of entering a location.

---

## User Persona

Maria is a home gardener in Portland, Oregon (45.5N latitude) planning a vegetable garden in her backyard. She wants to know where to plant tomatoes (full sun) versus lettuce (part shade). She has no background in astronomy or solar calculations. Her pain point is not knowing whether her backyard actually gets the 6+ hours of direct sunlight that tomatoes need, or how sun exposure changes from spring through fall.

---

## Screen Inventory

### Screen 1: Home Page (Location Input)

The home page is minimal and focused on a single task: getting the user's location. The page features a prominent heading "Solar-Sim" with a tagline "Calculate sun hours and light categories for any location on Earth."

**Location Input Component** provides three modes accessible via tabs:

The **Search tab** (default) shows a text input with placeholder "Enter city, address, or place name..." and a "Search" button. When the user searches, results appear in a dropdown list showing location name and coordinates. Clicking a result selects that location.

The **Coordinates tab** shows a text input accepting various formats like "45.5231, -122.6765" or "45 31' 23\" N, 122 40' 35\" W". A preview area shows the parsed coordinates with a "Use this location" button once valid input is detected.

The **Current Location tab** shows a large "Use my current location" button that triggers browser geolocation. A note explains that accuracy depends on the device.

**Planned Enhancement (S-018):** A Leaflet map picker will become the primary input method, allowing users to click on an interactive map, search with autocomplete, use GPS, or enter coordinates manually. The map should show OpenStreetMap tiles and place a marker when a location is selected.

---

### Screen 2: Results Page

The results page is the main content display, organized into several information sections that flow vertically. The page width is constrained to 800px for readability.

#### Section: Location Header

Display the selected location prominently at the top. Show the location name (if available), coordinates formatted to 4 decimal places, and timezone. Include a "Change location" link that returns to the home page.

Example display:
```
Portland, Oregon
45.5152, -122.6784 Pacific Time
```

#### Section: Today's Sun Data (SunDataCard)

A warm-colored card (amber/yellow palette) showing:

- **Large sun hours number**: "8.2" displayed prominently (2.5rem, bold)
- **Label**: "hours of sun"
- **Light category**: Icon and label like "Full Sun" with emoji (use only the category icons)
- **Category description**: Brief text explaining what this category means
- **Sunrise/Sunset times**: Two side-by-side blocks showing "6:45 AM" and "8:12 PM"
- **Date**: Full date displayed in the card header like "Wednesday, January 27, 2026"

Special states:
- Midnight sun shows "24 hours of daylight" notice
- Polar night shows "no sunrise today" notice

#### Section: Climate Information

This section contains two side-by-side cards plus a timeline visualization below them.

**Hardiness Zone Card** (green palette):
- Header: "USDA Hardiness Zone"
- Large zone badge: "8b" (2.5rem, bold)
- Temperature range: "15 to 20F"
- Note if approximate: "Estimated from coordinates" (italic, smaller)

**Frost Dates Card** (blue palette):
- Header: "Frost Dates"
- Two frost date entries stacked vertically:
  - "Last Spring Frost" label, "Apr 15" value, "Apr 1 - Apr 30" range
  - "First Fall Frost" label, "Nov 1" value, "Oct 15 - Nov 15" range

**Growing Season Timeline** (full width below cards):
A horizontal bar showing the year from January to December. The frost-free period is highlighted in green, with frost risk periods in gray. Vertical markers indicate the frost dates with labels above showing the date and "Last frost" or "First frost" text. Below the timeline, show legend swatches and details like "Growing season length: 150-180 days" and data confidence level.

**Planned Enhancement (S-018):** Add a Köppen climate classification badge showing the code (e.g., "Csb") and plain-English description ("Mediterranean - warm summer"). Add a monthly temperature chart showing average highs and lows throughout the year. Add a seasonal outlook section showing current weather patterns from NOAA CPC with guidance like "Above-normal temperatures expected through spring - consider earlier planting dates."

#### Section: Your Garden Plot (Planned - S-019)

This section will be inserted between sun data and climate information to let users model obstacles and see their effect on sun hours.

**PlotViewer Component** includes:
- **Toggle buttons**: "Plan View" and "3D View" tabs
- **View hint**: "Click to place obstacles, drag to move them" (plan) or "Drag to rotate view, scroll to zoom" (3D)
- **Main canvas area**: 600px minimum height
- **Time Scrubber**: Slider at bottom to scrub through the day (6 AM to 8 PM), showing current time and sun position

**Plan View (PlotEditor)** shows:
- Top-down grid with compass rose (N pointing up)
- Red dot at center representing the observation point
- Toolbar for adding obstacle types: Deciduous Tree, Evergreen Tree, Building, Fence, Hedge
- Obstacles appear as colored shapes that can be dragged
- Selected obstacle shows resize handles and a delete button
- Slope input panel with angle slider (0-45) and aspect dial (compass direction)

**3D/Isometric View** shows:
- Sky gradient background
- Ground plane with grid lines
- Obstacles rendered as 3D shapes (trees with trunks and canopy ellipses, buildings as extruded boxes)
- Shadow polygons projected on the ground (semi-transparent dark areas)
- Sun indicator showing current sun position
- Compass rose and scale bar

#### Section: Plant Recommendations

Two-column grid on desktop, single column on mobile.

**Main Column: PlantRecommendations Card** (warm yellow palette):
- Header: "Recommendations" with count "(24 plants suited)"
- Summary note with left border accent explaining the overall assessment
- Three collapsible sections for suitability tiers:
  - "Excellent Match" with star icon and count
  - "Good Match" with thumbs-up icon and count
  - "May Work" with thinking emoji and count
- Each tier contains plant lists grouped by category (Vegetables, Herbs, Flowers)
- Plant items show checkmark, plant name, and note icons (sparkle for benefits, warning for cautions, lightbulb for tips)
- Tips section at bottom with actionable advice

Example plants: Tomatoes, Peppers, Squash, Basil, Lettuce, Kale, Marigolds, Zinnias, Beans, Cucumbers

**Sidebar Column: Seasonal Light Chart** (purple palette):
- Header: "Seasonal Light Chart" with average hours summary
- Bar chart showing 12 months (Jan-Dec)
- Bars represent sun hours (0-15h scale on Y-axis)
- When shade data exists, show two bars per month: theoretical (lighter) and effective (darker)
- Legend explaining the bar colors
- Details showing summer peak, winter minimum, and highest shade impact month

#### Section: Planting Calendar

Full-width timeline (warm yellow palette) showing:
- Horizontal bar representing January through December
- Color-coded periods:
  - Purple: "Start seeds indoors" window
  - Orange: "Transplant outdoors" window
  - Green: Main growing season
  - Gray: Frost risk periods
- Vertical markers for key dates: seed start date, last frost, transplant deadline, first frost
- Legend with swatches
- Timing tips as a bulleted list explaining when to start seeds, transplant, and harvest

---

## Component Inventory

The app uses these reusable Svelte components:

| Component | Purpose |
|-----------|---------|
| LocationInput | Multi-mode location entry (search, coordinates, GPS) |
| MapPicker | Interactive Leaflet map for location selection (planned) |
| SunDataCard | Today's sun hours with category and times |
| GrowingSeasonTimeline | Visual timeline of frost-free period |
| PlantRecommendations | Categorized plant lists with notes |
| PlantingCalendar | Key planting dates and windows |
| SeasonalLightChart | Monthly sun hours bar chart |
| PlotEditor | Top-down obstacle placement canvas |
| IsometricView | 3D shadow visualization |
| TimeScrubber | Time-of-day slider with sun position |
| PlotViewer | Wrapper combining editor, 3D view, and scrubber |

---

## Data Fields Reference

### Sun Data
- **sunHours**: Decimal hours of sun (e.g., 8.2)
- **lightCategory**: One of "full-sun", "part-sun", "part-shade", "full-shade"
- **sunrise/sunset**: Times like "6:45 AM"
- **polarCondition**: "normal", "midnight-sun", or "polar-night"

### Climate Data
- **hardinessZone**: Zone string like "8b" with temperature range
- **lastSpringFrost**: Day of year with early/median/late range
- **firstFallFrost**: Day of year with early/median/late range
- **growingSeasonLength**: Days as range (short/typical/long)
- **koppenCode**: Climate code like "Csb" or "Dfa"
- **koppenDescription**: "Mediterranean - warm summer" or similar

### Plant Data
- **name**: Display name like "Tomato"
- **category**: "vegetable", "herb", or "flower"
- **suitability**: "excellent", "good", or "marginal"
- **notes**: Array of tips/cautions with type icons

---

## Interaction Patterns

### Map Picker (Planned)
- Click on map to place/move marker and select location
- Search input with autocomplete dropdown
- "Use my location" button for GPS
- Coordinates display that updates as marker moves

### PlotEditor Canvas
- Click empty space to open obstacle type selector menu
- Click obstacle to select it
- Drag obstacle to reposition (updates direction/distance automatically)
- Drag corner handles to resize width
- Press Delete key or click trash icon to remove
- Slider controls for slope angle (0-45)
- Circular dial for slope aspect (compass direction)

### IsometricView
- Drag anywhere to rotate the view angle
- Scroll/pinch to zoom in/out
- Toolbar buttons for zoom +/- and reset
- View automatically shows shadows based on current time

### TimeScrubber
- Drag slider to change time of day
- Labels show sunrise, solar noon, sunset
- Current time displayed prominently
- Sun position indicator updates in real-time

---

## State Variations

### Loading States
- Location search: "Searching..." button text
- Geolocation: Spinner with "Getting your location..."
- Sun calculation: Skeleton placeholder cards

### Empty States
- No obstacles: PlotViewer shows prompt "Add obstacles to see how shadows affect your sun hours"
- No recommendations: "No plants in our database match these conditions well. Consider container gardening in a sunnier spot."

### Error States
- Location search failed: Red alert with message and suggestion to try coordinates
- Geolocation denied: Yellow warning with instructions to update browser settings
- Invalid coordinates: Inline error under input with format suggestions

---

## Responsive Behavior

### Desktop (800px max-width container)
- Two-column grids for climate cards and recommendations
- Full PlotViewer with 600px height
- Side-by-side frost date display

### Mobile (< 600px)
- Single column layout throughout
- Climate cards stack vertically
- Recommendations main/sidebar stack vertically
- PlotViewer shows collapsed summary by default, expands to modal/fullscreen on tap
- Frost dates stack vertically
- Timeline month labels use smaller text

---

## Color Palette

The app uses semantic color palettes for different data types:

- **Sun/Light data**: Amber/yellow (#fbbf24, #fef3c7, #fffbeb)
- **Climate/Frost data**: Blue (#3b82f6, #bfdbfe, #eff6ff)
- **Growing/Plants data**: Green (#22c55e, #86efac, #f0fdf4)
- **Recommendations**: Yellow/gold (#f4d03f, #fef9e7)
- **Seasonal chart**: Purple/fuchsia (#d946ef, #fae8ff, #fdf4ff)
- **Obstacles**: Earth tones (trees: green, buildings: slate, fences: brown)
- **Shadows**: Semi-transparent black (30-40% opacity)

---

## Typography

- **Font family**: system-ui, -apple-system, sans-serif
- **Headings**: 1.25-2rem, weight 600-700
- **Body**: 0.875-1rem, weight 400-500
- **Labels**: 0.75-0.8125rem, uppercase, letter-spacing 0.025-0.05em
- **Numbers**: Monospace appearance for coordinates and measurements

---

## Example Data for Mockups

Use these values when generating mockups:

**Location**: Portland, Oregon (45.5152N, 122.6784W, Pacific Time)

**Sun Data**: 8.2 hours, Full Sun, Sunrise 6:45 AM, Sunset 8:12 PM

**Climate**:
- Hardiness Zone: 8b (15-20F)
- Last Spring Frost: Apr 15 (Apr 1 - Apr 30)
- First Fall Frost: Nov 1 (Oct 15 - Nov 15)
- Growing Season: 165 days typical (150-180 range)
- Köppen: Csb - Mediterranean (warm summer)

**Monthly Sun Hours** (approximate):
- Jan: 9h, Feb: 10h, Mar: 11h, Apr: 13h, May: 14h, Jun: 15h
- Jul: 15h, Aug: 14h, Sep: 12h, Oct: 10h, Nov: 9h, Dec: 8h

**Recommendations**:
- Excellent: Tomatoes, Peppers, Basil, Squash, Beans, Marigolds
- Good: Lettuce, Kale, Spinach, Cucumbers, Zinnias
- Marginal: Broccoli, Brussels Sprouts

**Obstacles** (for 3D view):
- Deciduous tree: 8m north, 6m tall, 4m wide
- Building (neighbor's house): 12m east, 8m tall, 10m wide
- Fence: 5m west, 2m tall

---

## Design Priorities

1. **Clarity over cleverness**: Gardeners want answers, not impressive visualizations. Every element should communicate useful information.

2. **Progressive disclosure**: Show the most important data (sun hours, category) immediately. Let users explore details (seasonal chart, 3D view) if interested.

3. **Mobile-first content**: The core experience (location, sun hours, recommendations) must work well on phones. Advanced features (PlotViewer) can be simplified on mobile.

4. **Warm, approachable aesthetic**: Gardening is a warm hobby. Use soft colors, rounded corners, and friendly icons rather than stark, technical styling.

5. **Fast perceived performance**: Show skeleton states immediately, animate data appearing, and provide feedback for every interaction.

---

## Out of Scope for Wireframes

These features are explicitly deferred and should not be included in initial mockups:

- User accounts or login
- Multi-location comparison
- Historical weather data or real-time cloud cover
- PDF export functionality
- Terrain elevation data (beyond simple slope input)
- Plant database editing or custom plant entry
