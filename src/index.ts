import type { FindBestDownloadUrlOptions, SpeedMeasurementOptions, UrlSpeedResult } from './types.js';

const DEFAULT_SAMPLE_BYTES = 256_000; // ~256 KB

/**
 * Measures the download speed of a URL.
 *
 * @param url - The URL to test
 * @param signal - AbortSignal to cancel the operation
 * @param options - Configuration options
 * @returns Promise with speed test results
 */
const measureDownloadSpeed = async (
    url: string,
    signal: AbortSignal,
    options?: SpeedMeasurementOptions,
): Promise<UrlSpeedResult> => {
    const sampleBytes = options?.sampleBytes ?? DEFAULT_SAMPLE_BYTES;
    const startTime = performance.now();

    // Add timeout if specified
    const controller = new AbortController();
    const timeoutId = options?.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;

    // Create a combined signal that aborts if either the passed signal or timeout signal aborts
    // Use the original signal as fallback if AbortSignal.any is not available
    const combinedSignal =
        typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, controller.signal]) : signal;

    try {
        const response = await fetch(url, { signal: combinedSignal });
        const ttfb = performance.now() - startTime; // Time to first byte

        if (!response.ok || !response.body) {
            throw new Error(`Failed: ${url} (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        let totalBytes = 0;
        const downloadStart = performance.now();

        while (totalBytes < sampleBytes) {
            const { done, value } = await reader.read();

            if (done || !value) {
                break;
            }

            totalBytes += value.byteLength;

            // Report progress if callback provided
            if (options?.onProgress) {
                const currentTime = performance.now();
                const elapsedSecs = (currentTime - downloadStart) / 1000;
                const currentSpeed = elapsedSecs > 0 ? totalBytes / elapsedSecs : 0;

                options.onProgress({
                    bytesDownloaded: totalBytes,
                    currentSpeed,
                    totalBytes: sampleBytes,
                    url,
                });
            }
        }

        const duration = (performance.now() - downloadStart) / 1000; // seconds
        const speed = totalBytes / duration; // bytes/sec

        return {
            latency: ttfb,
            speed,
            url,
        };
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
    }
};

/**
 * Validates a URL string.
 *
 * @param url - URL to validate
 * @param httpsOnly - Whether to only allow HTTPS URLs
 * @returns True if valid, false otherwise
 */
const validateUrl = (url: string, httpsOnly = false): boolean => {
    try {
        const parsed = new URL(url);
        return httpsOnly ? parsed.protocol === 'https:' : true;
    } catch {
        return false;
    }
};

/**
 * Finds the fastest download URL from a list of URLs.
 *
 * @param urls - Array of URLs to test
 * @param options - Configuration options
 * @returns Promise that resolves to the best URL
 * @throws Error if all URLs fail
 */
export const findBestDownloadUrl = async (urls: string[], options?: FindBestDownloadUrlOptions): Promise<string> => {
    // Validate URLs if httpsOnly is enabled
    const validUrls = options?.httpsOnly
        ? urls.filter((url) => validateUrl(url, true))
        : urls.filter((url) => validateUrl(url));

    if (validUrls.length === 0) {
        throw new Error('No valid URLs provided');
    }

    // Create abort controllers for each URL
    const controllers = validUrls.map(() => new AbortController());

    // Create speed test promises for each URL
    const speedTests = validUrls.map((url, index) => {
        const signal = controllers[index].signal;

        return measureDownloadSpeed(url, signal, {
            onProgress: options?.onProgress,
            sampleBytes: options?.sampleBytes,
            timeoutMs: options?.timeoutMs,
        })
            .then((result) => {
                // Abort other fetches when we have a successful result
                controllers.forEach((controller, i) => {
                    if (i !== index) controller.abort();
                });

                return result;
            })
            .catch((err) => {
                if (options?.onUrlFailure) {
                    options.onUrlFailure(url, err);
                }
                return null; // Mark this one as failed
            });
    });

    try {
        // Wait for any successful result
        const results = await Promise.all(speedTests);
        const validResults = results.filter(Boolean) as UrlSpeedResult[];

        if (validResults.length === 0) {
            throw new Error('All speed tests failed');
        }

        // Find the fastest URL
        const fastest = validResults.reduce(
            (fastest, current) => (current.speed > fastest.speed ? current : fastest),
            validResults[0],
        );

        return fastest.url;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`All speed tests failed. Last error: ${msg}`);
    }
};

/**
 * Checks the health of multiple URLs without full speed testing.
 *
 * @param urls - URLs to check
 * @param options - Configuration options
 * @returns Promise with health status for each URL
 */
export const checkUrlsHealth = async (
    urls: string[],
    options?: {
        httpsOnly?: boolean;
        timeoutMs?: number;
    },
): Promise<{ error?: string; healthy: boolean; url: string }[]> => {
    // Validate URLs if httpsOnly is enabled
    const validUrls = options?.httpsOnly
        ? urls.filter((url) => validateUrl(url, true))
        : urls.filter((url) => validateUrl(url));

    const checks = validUrls.map(async (url) => {
        try {
            const controller = new AbortController();
            const timeoutId = options?.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;

            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    signal: controller.signal,
                });

                return {
                    error: response.ok ? undefined : `HTTP ${response.status}`,
                    healthy: response.ok,
                    url,
                };
            } finally {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }
            }
        } catch (err) {
            return {
                error: err instanceof Error ? err.message : String(err),
                healthy: false,
                url,
            };
        }
    });

    return Promise.all(checks);
};

export * from './types.js';
