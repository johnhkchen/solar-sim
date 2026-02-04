/**
 * API endpoint to proxy canopy height tile requests.
 *
 * The Meta/WRI canopy height data on S3 doesn't have CORS headers enabled,
 * so we proxy the requests through our server to bypass browser restrictions.
 *
 * The geotiff library uses HEAD requests to check file size and range support
 * before making partial reads, so we need to support both HEAD and GET.
 */

import type { RequestHandler } from './$types';

const S3_BASE_URL = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm';

/**
 * Builds response headers for proxied tile responses.
 */
function buildResponseHeaders(upstreamResponse: Response): Headers {
	const headers = new Headers();
	headers.set('Content-Type', 'image/tiff');
	headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
	headers.set('Accept-Ranges', 'bytes'); // Always indicate we support range requests

	// Forward content-related headers
	const contentLength = upstreamResponse.headers.get('Content-Length');
	if (contentLength) {
		headers.set('Content-Length', contentLength);
	}

	const contentRange = upstreamResponse.headers.get('Content-Range');
	if (contentRange) {
		headers.set('Content-Range', contentRange);
	}

	return headers;
}

/**
 * Validates quadkey format.
 */
function isValidQuadkey(quadkey: string | undefined): quadkey is string {
	return !!quadkey && /^[0-3]+$/.test(quadkey);
}

/**
 * HEAD request handler - used by geotiff to check file size and range support.
 */
export const HEAD: RequestHandler = async ({ params }) => {
	const { quadkey } = params;

	if (!isValidQuadkey(quadkey)) {
		return new Response(null, { status: 400 });
	}

	const tileUrl = `${S3_BASE_URL}/${quadkey}.tif`;

	try {
		const response = await fetch(tileUrl, { method: 'HEAD' });

		if (!response.ok) {
			return new Response(null, { status: response.status });
		}

		return new Response(null, {
			status: 200,
			headers: buildResponseHeaders(response)
		});
	} catch (error) {
		console.error('Canopy tile HEAD error:', error);
		return new Response(null, { status: 502 });
	}
};

/**
 * GET request handler - fetches tile data, supports range requests for COG.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const { quadkey } = params;

	if (!isValidQuadkey(quadkey)) {
		return new Response('Invalid quadkey', { status: 400 });
	}

	const tileUrl = `${S3_BASE_URL}/${quadkey}.tif`;

	try {
		// Forward range headers for partial reads (COG optimization)
		const headers: HeadersInit = {};
		const rangeHeader = request.headers.get('Range');
		if (rangeHeader) {
			headers['Range'] = rangeHeader;
		}

		const response = await fetch(tileUrl, { headers });

		if (!response.ok && response.status !== 206) {
			if (response.status === 404) {
				return new Response('Tile not found', { status: 404 });
			}
			return new Response(`Upstream error: ${response.status}`, { status: response.status });
		}

		return new Response(response.body, {
			status: response.status,
			headers: buildResponseHeaders(response)
		});
	} catch (error) {
		console.error('Canopy tile GET error:', error);
		return new Response('Failed to fetch tile', { status: 502 });
	}
};
