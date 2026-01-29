---
id: S-006
title: Location Input System
status: in-progress
priority: 1
milestone: M8
---

# S-006: Location Input System

This story covers how users specify their location, from address entry through coordinate resolution and timezone detection.

## Context

The happy path begins with Maria typing "Portland, OR" and receiving validated coordinates with timezone. This seemingly simple interaction requires geocoding, coordinate validation, timezone inference, and clear UI feedback. The experience must feel instant and forgiving of typos or ambiguous input.

Research in S-006-R evaluated geocoding APIs and architectural approaches and determined that Nominatim provides the best fit for our modest geocoding needs. The API is free with reasonable rate limits, supports CORS for direct browser calls, and requires only that we avoid autocomplete-style rapid requests. For timezone detection, the tz-lookup library offers offline inference from coordinates in approximately 72KB, avoiding additional API dependencies. These choices keep the implementation simple while meeting all requirements.

## Module Architecture

The location system lives in `src/lib/geo/` for core logic and `src/lib/components/` for the UI component. The geo module consists of four files that handle distinct responsibilities.

### Types and Constants (types.ts)

All TypeScript interfaces live in a dedicated types file for easy importing. This includes coordinate types, location result types, and geocoding response types. The file also exports constants for rate limiting and validation bounds.

### Coordinate Module (coordinates.ts)

The coordinate module handles parsing and validation of user-entered coordinates. It accepts decimal degrees as the primary format and degrees-minutes-seconds as the secondary format, using geo-coordinates-parser for flexible input handling. The module exports functions to parse coordinate strings into normalized decimal values and to validate that coordinates fall within valid ranges. When parsing fails, it returns structured error information that the UI can display helpfully.

### Timezone Module (timezone.ts)

The timezone module wraps tz-lookup to infer timezone from coordinates. It takes a latitude and longitude and returns an IANA timezone identifier like "America/Los_Angeles". The module handles the edge case where tz-lookup returns undefined for locations in international waters by falling back to UTC and setting a flag indicating the fallback occurred. This lets the UI warn users to verify timezone manually when needed.

### Geocoding Module (geocoding.ts)

The geocoding module handles Nominatim API calls for converting addresses to coordinates. It implements client-side rate limiting to respect Nominatim's one-request-per-second policy, formats requests with proper User-Agent headers as required by the usage policy, and parses responses into our internal types. The module handles network failures gracefully by returning structured errors that distinguish between rate limiting, network issues, and no-results-found conditions. Attribution text for OpenStreetMap is included in the response so the UI can display it.

### Main Export (index.ts)

The index file re-exports all public interfaces and functions from the submodules. Consumers import everything from `$lib/geo` without needing to know the internal file structure. The file also exports a convenience function that combines geocoding and timezone lookup into a single call for the common address-to-location flow.

## TypeScript Interfaces

The location system exposes the following interfaces for inputs and outputs.

### Core Types

```typescript
interface Coordinates {
  latitude: number;  // -90 to 90, positive is north
  longitude: number; // -180 to 180, positive is east
}

interface Location extends Coordinates {
  timezone: string;       // IANA timezone identifier
  name?: string;          // display name from geocoding
  timezoneIsEstimate?: boolean;  // true when tz-lookup fell back to UTC
}

interface LocationResult {
  location: Location;
  attribution: string;    // OpenStreetMap attribution for display
}
```

### Geocoding Types

```typescript
interface GeocodingOptions {
  limit?: number;         // max results to return, default 5
  bounded?: boolean;      // restrict to viewport bounds
}

type GeocodingError =
  | { type: 'rate-limited'; retryAfter: number }
  | { type: 'network-error'; message: string }
  | { type: 'no-results'; query: string }
  | { type: 'invalid-response'; message: string };

type GeocodingResult =
  | { success: true; results: LocationResult[] }
  | { success: false; error: GeocodingError };
```

### Coordinate Parsing Types

```typescript
type CoordinateFormat = 'decimal' | 'dms' | 'ddm' | 'unknown';

interface ParsedCoordinates extends Coordinates {
  format: CoordinateFormat;
}

type ParseError =
  | { type: 'invalid-format'; input: string }
  | { type: 'out-of-range'; field: 'latitude' | 'longitude'; value: number };

type ParseResult =
  | { success: true; coordinates: ParsedCoordinates }
  | { success: false; error: ParseError };
```

## Component Architecture

The location input component lives at `src/lib/components/LocationInput.svelte` and provides a unified interface for all location input methods. The component offers three input modes that users can switch between freely.

### Address Search Mode

The default mode presents a text input where users type a place name or address and click a search button to trigger geocoding. The search button only activates when input is non-empty, and it disables during the API call to prevent duplicate requests. Results appear in a list below the input, and clicking a result selects it as the current location. When geocoding returns multiple results like several cities named Springfield, the component shows all options with state or country qualifiers for disambiguation.

### Manual Coordinates Mode

This mode presents separate latitude and longitude text inputs that accept various formats. As the user types, the component attempts to parse the input and shows either a preview of the parsed coordinates or a helpful error message. The component normalizes different formats like "45° 30' 12" N" into decimal degrees for display consistency. A detect-format indicator shows users what format was recognized, helping them understand why parsing succeeded or failed.

### Current Location Mode

This mode presents a button that triggers browser geolocation when clicked. Before triggering the permission prompt, the component checks the permission state using the Permissions API. If permission was previously denied, it shows instructions for re-enabling in browser settings instead of a useless prompt. If permission was previously granted, it proceeds directly to getting the position. On desktop, the component shows a note that accuracy may be limited since GPS is typically unavailable.

### Shared Behavior

All three modes converge on the same output interface. When the user selects a location through any method, the component emits a location-selected event with a complete Location object containing coordinates, timezone, and display name. The component also maintains a loading state, error state, and current-location state that the parent can use for display purposes.

The component tracks whether the current location was obtained via geolocation, geocoding, or manual entry so the parent can display appropriate attribution text when required. Geolocation results need no attribution, geocoding results require OpenStreetMap attribution, and manual coordinates need no attribution.

## API Integration

The geocoding integration uses direct client-side calls to Nominatim rather than proxying through our edge function. This keeps the architecture simple and avoids adding latency. The integration handles several concerns.

### Rate Limiting

The geocoding module maintains a timestamp of the last request and ensures at least one second passes between requests. If a geocoding call is attempted within the rate limit window, the module queues the request and executes it after the window closes. This happens transparently to callers, who simply await the result.

### Request Headers

Each request includes a User-Agent header identifying our application as required by Nominatim's usage policy. The header follows the format "SolarSim/1.0 (https://solar-sim.example.com; contact@example.com)" with actual values substituted at build time.

### Response Parsing

Nominatim returns a JSON array of place results, each containing display_name, lat, lon, and various metadata fields. The geocoding module extracts the fields we need and discards the rest, constructing our internal types. The module handles the case where Nominatim returns an empty array by returning a no-results error rather than an empty success.

### Offline Fallback

When network requests fail, the component automatically switches emphasis to manual coordinate entry, pre-populating a message that explains geocoding is unavailable and coordinates can be entered directly. This ensures the application remains useful even without network access.

## Error Handling Strategy

Each layer of the system handles errors appropriate to its level, passing structured error information up the stack for presentation.

### Module Level

The geocoding and coordinate modules return union types that distinguish success from various failure modes. Callers pattern-match on the result type to determine how to proceed. This forces error handling to be explicit rather than relying on exceptions.

### Component Level

The LocationInput component translates module-level errors into user-facing messages. Rate limit errors become "Please wait a moment before searching again." Network errors become "Unable to reach location service. You can enter coordinates manually below." Parse errors show the specific issue like "Latitude must be between -90 and 90."

### User Feedback

All error states are recoverable. The user can fix their input and try again, switch to a different input mode, or close and reopen the component to reset state. The component never enters a stuck state where the user cannot proceed.

## Test Strategy

Testing follows three categories covering unit tests, integration tests, and component tests.

### Unit Tests

Unit tests verify coordinate parsing with various input formats including decimal degrees, degrees-minutes-seconds with different delimiter styles, and edge cases near the poles and date line. Tests verify timezone inference for locations in each major timezone and boundary regions. Tests mock network responses to verify geocoding result parsing and error handling.

### Integration Tests

Integration tests verify the full flow from address input through geocoding, timezone lookup, and result construction. These tests use recorded responses rather than hitting live APIs, ensuring reproducibility. Tests cover the rate limiting behavior by simulating rapid requests and verifying appropriate queuing.

### Component Tests

Component tests verify the UI behavior in each input mode. Tests simulate user interactions like typing, clicking, and selecting results, verifying that the component emits correct events and displays appropriate feedback. Tests verify the geolocation permission flow by mocking the Permissions API and Geolocation API.

## Implementation Tickets

The implementation work divides into four tickets that can be completed sequentially.

### T-006-01: Coordinate Parsing and Validation

This ticket implements the coordinate module that handles parsing and validation. The deliverable is `src/lib/geo/coordinates.ts` exporting `parseCoordinates` and `validateCoordinates` functions with full type safety. The implementation installs geo-coordinates-parser as a dependency, wraps it with our types, and adds validation logic. Tests cover decimal degrees, DMS format, boundary values, and error cases.

### T-006-02: Timezone Detection

This ticket implements the timezone module that wraps tz-lookup. The deliverable is `src/lib/geo/timezone.ts` exporting a `getTimezone` function that takes coordinates and returns an IANA timezone identifier. The implementation installs tz-lookup as a dependency, handles the undefined fallback case, and sets appropriate flags. Tests verify correct zones for major cities and edge cases like international waters.

### T-006-03: Geocoding Integration

This ticket implements the geocoding module for Nominatim integration. The deliverable is `src/lib/geo/geocoding.ts` exporting a `geocodeAddress` function with rate limiting and error handling. The implementation handles request formatting, response parsing, and the various error conditions. Tests mock the fetch API to verify correct behavior without hitting live endpoints.

### T-006-04: Location Input Component

This ticket implements the Svelte component providing the unified location input UI. The deliverable is `src/lib/components/LocationInput.svelte` with all three input modes and appropriate feedback states. The implementation uses the geo modules from previous tickets and adds the UI layer. Tests verify user interactions and event emissions in each mode.

## Acceptance Criteria

The location system is complete when users can enter addresses and receive validated coordinates with detected timezone, manually enter coordinates in decimal degrees or DMS format, use browser geolocation when permitted, see immediate feedback for valid and invalid inputs, and the system works offline with manual coordinate entry even when geocoding is unavailable. The OpenStreetMap attribution must appear whenever geocoding results are displayed. The component must handle all error states gracefully without entering stuck states.

## Dependencies

This story depends on S-004 which scaffolded the SvelteKit project. The scaffolding created placeholder files in `src/lib/geo/` that this story will implement. The solar engine from S-005 uses the Location type defined here to compute sun hours for a location, though the two systems can be developed in parallel since the interface is already defined.

## Research References

The research document at `docs/knowledge/research/location-geocoding.md` contains the full analysis that informed these decisions. Key findings include the Nominatim recommendation, client-side architecture, tz-lookup for timezone detection, and browser geolocation best practices.
