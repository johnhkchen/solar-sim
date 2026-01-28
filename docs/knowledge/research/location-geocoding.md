# Location and Geocoding Research

> **Task**: S-006-R - Research location and geocoding options
> **Status**: Complete
> **Date**: 2026-01-28

This document captures research findings for the location input system described in S-006. It evaluates geocoding API options, client-side versus edge proxy architectures, timezone inference approaches, browser geolocation patterns, and coordinate format edge cases to inform implementation decisions.

---

## Executive Summary

After evaluating available geocoding APIs and architectural approaches, a hybrid strategy emerges as the recommended path for Solar-Sim. The Nominatim public API provides free, high-quality geocoding for address lookups with reasonable rate limits, while client-side calls avoid the complexity of proxying through our edge function. For timezone inference, the tz-lookup library offers the best tradeoff between accuracy and bundle size, providing offline timezone detection without API calls. Browser geolocation should be offered as a secondary input method with careful UX consideration around permission flows, and coordinate parsing should support common formats including decimal degrees and degrees-minutes-seconds notation.

The key insight driving these recommendations is that Solar-Sim's geocoding needs are modest. Users typically enter one location per session, and the app does not require features like search-as-you-type autocomplete that would push rate limits. This simplifies our requirements considerably compared to applications with continuous geocoding demands.

---

## Geocoding API Evaluation

Converting place names like "Portland, OR" into coordinates requires a geocoding service. Several options exist with different tradeoffs around cost, accuracy, rate limits, and Cloudflare Workers compatibility.

### Nominatim (OpenStreetMap)

Nominatim powers the search on openstreetmap.org and serves roughly 30 million queries per day from a single server. The public API is free for reasonable use, with a rate limit of one request per second and a practical throughput of about 3,500 addresses per hour. These limits are generous for an application like Solar-Sim where users enter at most a few locations per session.

The API is well-documented and returns comprehensive results including coordinates, display names, bounding boxes, and place classifications. It supports both forward geocoding (address to coordinates) and reverse geocoding (coordinates to address), though we primarily need forward geocoding. The data comes from OpenStreetMap, which means coverage is excellent in most regions but may have gaps in some developing areas.

One important restriction is that Nominatim's usage policy prohibits autocomplete implementations that send a request on each keystroke. The policy expects applications to wait for the user to finish typing before submitting a query. This aligns with our planned UX of having users type a location and press enter or click a search button, rather than showing live suggestions as they type.

Attribution to OpenStreetMap contributors is required when using Nominatim, which we can satisfy with a small credit line in the UI. The service is licensed under ODbL, and there are no restrictions on commercial use as long as the usage policy is followed.

### Mapbox Geocoding API

Mapbox offers a generous free tier of 100,000 requests per month for their Temporary Geocoding API, which would be more than sufficient for Solar-Sim's needs. The service provides excellent coverage and accuracy, with support for search-as-you-type autocomplete through their Search JS SDK.

However, several constraints make Mapbox less attractive for our use case. The Temporary API prohibits storing or caching results, which means we could not save a user's last-used location across sessions. Upgrading to the Permanent API for storage rights starts at $5 per 1,000 requests with no free tier. Additionally, Mapbox prohibits bulk or automated geocoding without an Enterprise license, which could complicate any future batch processing features.

The rate limit of 600 requests per minute is generous but creates complexity when implementing autocomplete, since each keystroke triggers a request. Mapbox recommends waiting until users have typed at least 3-4 characters before beginning requests, and limiting to 5-10 requests per second for responsive yet efficient autocomplete.

### OpenCage Data

OpenCage provides a clean geocoding API with explicit CORS support for browser-based requests. They offer a Cloudflare Workers SDK that makes integration straightforward for edge deployments. The free tier includes 2,500 requests per day, which covers typical usage patterns, though it could be restrictive for applications with higher traffic.

The API returns timezone information alongside coordinates, which would simplify our architecture by combining geocoding and timezone detection into a single request. This is a meaningful advantage over Nominatim, which returns coordinates but not timezone data.

### Photon (Self-Hosted Option)

Photon is an open-source geocoder built on OpenStreetMap data that supports search-as-you-type with multilingual results. Komoot provides a public API at photon.komoot.io for light use, but extensive usage gets throttled without clear rate limit documentation.

Self-hosting Photon requires significant infrastructure since a planet-wide database needs about 220GB of disk space and at least 64GB of RAM for smooth operation. This is overkill for Solar-Sim's modest geocoding needs, but worth noting as an option if we ever need unrestricted throughput.

### Recommendation

Nominatim is the recommended choice for Solar-Sim's geocoding needs. Its free tier with one request per second easily handles our expected usage pattern of one location lookup per user session. The prohibition on autocomplete aligns with our planned search-and-submit UX rather than being a constraint. Coverage is comprehensive for the gardening and farming audiences we serve, and the OpenStreetMap attribution requirement is straightforward to satisfy.

If we later want to add autocomplete functionality, we should revisit Mapbox or OpenCage. For now, Nominatim provides everything we need without API keys, paid tiers, or infrastructure complexity.

---

## Client-Side vs Edge Proxy Architecture

A fundamental architectural question is whether geocoding requests should go directly from the user's browser to the geocoding API, or whether they should be proxied through our Cloudflare Workers edge function.

### Direct Client-Side Calls

In the direct approach, the browser makes fetch requests directly to the Nominatim API. This has several advantages. There is no additional latency from routing through our edge function, no Cloudflare Workers CPU time consumed on geocoding requests, and simpler deployment since we do not need to maintain proxy logic or handle API error forwarding.

Nominatim supports CORS with permissive headers, so browser-based requests work without any proxying. The main requirements are sending a proper User-Agent or Referer header identifying our application, and respecting the one-request-per-second rate limit.

The disadvantage is that users' IP addresses are visible to the Nominatim service rather than being masked behind our edge. For a privacy-sensitive application this might matter, but for a sun-hours calculator where users voluntarily provide their location, it is unlikely to be a concern. We are not processing sensitive data, and the user is explicitly sharing their location anyway.

### Edge Proxy Approach

Proxying through Cloudflare Workers would route geocoding requests from the browser to our edge function, which then calls Nominatim and forwards the response. This adds one network hop but provides some benefits. We could implement caching at the edge to reduce repeated lookups for the same location, we could aggregate rate limiting across all users rather than relying on per-browser limits, and we could add our own error handling and fallback logic.

Cloudflare Workers can cache API responses using the Cache API or KV storage. For geocoding, this could be valuable since the coordinates for "Portland, OR" do not change. A cached result could serve subsequent requests instantly without hitting Nominatim at all. The tradeoff is added complexity in cache invalidation and storage management.

However, Geocode Earth's documentation explicitly advises against proxying their API due to the latency introduced, and this reasoning applies to Nominatim as well. The public Nominatim API is fast and reliable, and adding a proxy layer doubles the network latency without meaningful benefit for our use case.

### Recommendation

Direct client-side calls to Nominatim are the recommended approach. The simplicity advantage outweighs the potential benefits of edge proxying, and the latency savings matter for perceived responsiveness. We should implement proper rate limiting on the client side (waiting for user to finish typing before searching) and include our application identifier in request headers as required by Nominatim's usage policy.

If we later need caching for frequently-searched locations, we can implement browser-local caching using localStorage without involving the edge at all. This keeps the architecture simple while still reducing redundant API calls.

---

## Timezone Inference from Coordinates

Once we have coordinates for a location, we need to determine its timezone for displaying sunrise and sunset times in local time. Several approaches exist with different tradeoffs around accuracy, bundle size, and API dependency.

### tz-lookup Library

The tz-lookup library from PhotoStructure provides fast, memory-efficient timezone estimation from coordinates. It works entirely offline using a compressed shape file embedded in the package, with no API calls required. The library weighs approximately 72KB minified and gzipped, which fits comfortably within Cloudflare Workers' bundle size limits.

The key tradeoff is accuracy versus size. The library uses a simplified approximation of timezone boundaries that may disagree with exact geographic boundaries in about 10% of populated locations. However, most disagreements involve timezones with the same UTC offset (like America/Chicago versus America/Winnipeg), so the practical impact is minimal for sun-hours calculations where we primarily care about the offset rather than the specific zone name.

For our use case, tz-lookup's approximations are acceptable. Whether a location in northern Indiana is classified as America/Chicago or America/Indiana/Indianapolis does not affect our solar calculations as long as we get the correct UTC offset. The library handles this case correctly.

### geo-tz Library

The geo-tz library provides exact geographic timezone lookups by storing the actual timezone boundary shapes from the timezone-boundary-builder project. This yields highly accurate results that match the authoritative timezone data, but the accuracy comes at a cost of approximately 900KB bundle size and slower lookup times.

For applications where the precise timezone zone name matters (such as calendar applications that need to handle daylight saving transitions correctly years into the future), geo-tz is the better choice. For our purposes of converting sunrise and sunset times to local display times, the additional precision does not provide meaningful benefit.

### API-Based Options

Google's Time Zone API and similar services provide timezone data via HTTP requests, returning both UTC offset and daylight saving information for any coordinate and timestamp. These APIs are authoritative and always current, but they introduce network dependency and potential costs.

For an application like Solar-Sim that aims to work offline with manual coordinate entry, adding a timezone API dependency would compromise that goal. We want users to be able to enter raw coordinates and get results without network access.

### Recommendation

Use tz-lookup for timezone inference. Its 72KB bundle size is manageable, its offline operation supports our offline-capable goals, and its accuracy is sufficient for converting solar times to local display. The library should be loaded client-side alongside our solar calculation code.

One edge case to handle is locations in international waters or disputed territories where timezone data may be ambiguous. The tz-lookup library returns UTC for locations that do not fall within any defined timezone shape, which is a reasonable fallback. We should display a note to users when their location returns UTC, suggesting they verify their timezone manually if results seem incorrect.

---

## Browser Geolocation API Patterns

Modern browsers provide the Geolocation API for determining the user's current position via GPS, WiFi, or cell tower triangulation. This offers a convenient "use my location" option but requires careful UX design around permission handling.

### Permission Flow Best Practices

User studies consistently show that prompting for location permission immediately on page load creates distrust and high denial rates. The recommended pattern is to wait for a clear user gesture like clicking a "Use my current location" button before triggering the permission request. This gives users context for why the permission is needed and makes granting it feel like a deliberate choice rather than an imposition.

When the user clicks our location button, we should first check the permission state using the Permissions API's query method. If permission was previously granted, we can proceed directly to getting the position. If permission was previously denied, we should display a helpful message explaining how to re-enable it in browser settings rather than showing a permission prompt that will be automatically rejected. Only if the permission state is "prompt" (meaning the user has not yet decided) should we call getCurrentPosition and trigger the browser's permission dialog.

### Desktop vs Mobile Considerations

GPS-based geolocation on mobile devices is typically accurate to within a few meters, making it excellent for garden or farm locations. Desktop browsers without GPS sensors rely on IP-based location estimation, which may return positions that are kilometers away from the actual location, especially for users connecting through VPNs or corporate networks.

Our UI should indicate that manual coordinate entry or address search may be more accurate than geolocation for desktop users. A note like "Location accuracy varies on desktop devices" helps set appropriate expectations without discouraging use of the feature.

### Secure Context Requirement

The Geolocation API is restricted to secure contexts (HTTPS) in modern browsers. Since Cloudflare Workers automatically serve content over HTTPS, this is not a concern for our deployment, but it means the feature will not work during local development on localhost without special configuration.

### Fallback Handling

When geolocation fails or is denied, the UI must provide clear alternative paths. Offering a text field for address entry or manual coordinates alongside the geolocation button ensures users can always complete their task. The geolocation feature should enhance the experience, not gate it.

### Recommendation

Implement browser geolocation as a secondary input method with a clear "Use my location" button. Check permission state before triggering prompts to provide appropriate messaging. Display accuracy caveats for desktop users, and always maintain address search and manual coordinate entry as primary alternatives. Test the permission flow on both mobile and desktop to ensure graceful handling of all states.

---

## Coordinate Format Edge Cases

Users may enter coordinates in various formats depending on their background and the source of their data. Supporting multiple input formats gracefully improves usability without adding significant complexity.

### Common Formats

Decimal degrees is the most common modern format and what our internal calculations use. Coordinates appear as signed floating-point numbers like 45.5231 for latitude and -122.6765 for longitude, with negative values indicating south or west. This format is what Google Maps displays and what most GPS devices export.

Degrees-minutes-seconds (DMS) notation appears in older sources and some official documents. Coordinates appear as values like 45° 31' 23" N, 122° 40' 35" W. This format requires parsing the degree, minute, and second components and combining them with the hemisphere indicator to produce a signed decimal value.

Degrees-decimal-minutes (DDM) is less common but appears in some marine and aviation contexts. Coordinates appear as values like 45° 31.383' N, meaning 45 degrees plus 31.383 minutes. This is simpler to parse than full DMS since there is no seconds component.

Some sources omit hemisphere indicators and use signed values, while others include indicators but may place them before or after the numeric components. A robust parser should handle variations like "N 45.5231" and "45.5231 N" equivalently.

### Parsing Libraries

The geo-coordinates-parser library handles a wide variety of input formats and normalizes them to decimal degrees. It supports formats with and without hemisphere indicators, various delimiter styles, and mixed formats where latitude and longitude use different notations. The library includes validation to reject invalid coordinates (latitude outside -90 to 90, longitude outside -180 to 180).

For TypeScript projects, the CoordConversions library provides typed parsing with automatic hemisphere detection and comprehensive validation. It explicitly supports conversion between decimal degrees, degrees-minutes, and degrees-minutes-seconds formats in both directions.

### Validation Requirements

Beyond format parsing, validation should reject physically impossible coordinates. Latitude values outside the -90 to 90 range are invalid, as are longitude values outside -180 to 180. The parser should also handle common user errors like swapping latitude and longitude (a longitude of 45 is suspicious when paired with a latitude of 122) and provide helpful error messages.

Precision validation is less critical since users may enter coordinates with anywhere from zero to many decimal places. Five or six decimal places represent sub-meter precision, which is far more than needed for solar calculations. We should accept high-precision input without complaint but not imply our results are accurate to that precision.

### Recommendation

Support decimal degrees as the primary format and degrees-minutes-seconds as the secondary format. Use geo-coordinates-parser or similar library for flexible input parsing with validation. Display parsed coordinates back to the user in a normalized format so they can verify the interpretation. For the MVP, focus on decimal degrees and common DMS formats, adding support for more exotic formats only if user feedback indicates need.

---

## Implementation Recommendations

Based on this research, the location input system should be structured around direct client-side geocoding with Nominatim, offline timezone detection with tz-lookup, and flexible coordinate input parsing.

### Module Organization

Create a `src/lib/geo/` directory containing modules for geocoding, timezone detection, coordinate parsing, and validation. The geocoding module wraps Nominatim API calls and handles rate limiting. The timezone module wraps tz-lookup with fallback handling. The coordinate module parses various input formats into normalized decimal degrees. Each module should export clean TypeScript interfaces that hide implementation details.

### Component Architecture

The location input component should offer three input modes presented as tabs or toggleable options. Address search provides a text input with a search button that triggers Nominatim lookup. Manual coordinates provides separate latitude and longitude fields accepting various formats. Current location provides a button that triggers browser geolocation when available.

All three modes converge on the same output: validated decimal coordinates with detected timezone and display name. The component should emit this standardized result regardless of input mode, making downstream consumers agnostic to how the location was obtained.

### Error Handling

Network failures during geocoding should display user-friendly messages and suggest manual coordinate entry as an alternative. Rate limit errors from Nominatim (which appear as HTTP 429) should trigger client-side backoff and retry logic, though our expected usage should rarely hit these limits. Geolocation permission denials should display instructions for re-enabling rather than repeatedly prompting.

Timezone detection failures should fall back to UTC with a visible indicator so users know to verify times manually. Invalid coordinate inputs should show specific validation errors (latitude out of range, unrecognized format) rather than generic failures.

### Testing Strategy

Test geocoding with known addresses and verify returned coordinates fall within expected bounds. Test coordinate parsing with a variety of input formats including edge cases like coordinates on the international date line or near the poles. Test timezone detection for locations in each major timezone and verify correct handling of boundaries and edge cases.

Test the browser geolocation flow in both permission-granted and permission-denied states, verifying appropriate UI updates in each case. Test offline behavior by simulating network failures and confirming the application provides useful functionality with manual coordinate entry.

---

## References

The following sources informed this research:

Nominatim documentation and usage policy are available at https://nominatim.org/ and https://operations.osmfoundation.org/policies/nominatim/. The tz-lookup library is maintained at https://github.com/photostructure/tz-lookup with the geo-tz alternative at https://github.com/evansiroky/node-geo-tz. Browser geolocation API documentation is available at https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API with permission best practices at https://web.dev/articles/permissions-best-practices. The geo-coordinates-parser library is documented at https://www.npmjs.com/package/geo-coordinates-parser. Mapbox geocoding documentation is at https://docs.mapbox.com/api/search/geocoding/ and OpenCage at https://opencagedata.com/api. The S-006 story document at docs/active/stories/S-006-location-input.md provides additional context for these requirements.
