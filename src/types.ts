/**
 * Options for finding the best download URL.
 */
export type FindBestDownloadUrlOptions = SpeedMeasurementOptions & {
    /** Threshold to terminate testing early if a URL is clearly faster */
    earlyTerminationThreshold?: number;
    /** Whether to only allow HTTPS URLs */
    httpsOnly?: boolean;
    /** Maximum concurrent download tests */
    maxConcurrent?: number;
    /** Callback when a URL fails testing */
    onUrlFailure?: (url: string, err: Error) => void;
    /** Number of retries for failed URLs */
    retries?: number;
    /** Delay between retries in milliseconds */
    retryDelayMs?: number;
};

/**
 * Progress information during download testing.
 */
export type ProgressInfo = {
    /** Number of bytes downloaded so far */
    bytesDownloaded: number;
    /** Current calculated speed in bytes/second */
    currentSpeed: number;
    /** Total sample bytes target */
    totalBytes: number;
    /** URL being tested */
    url: string;
};

/**
 * Configuration options for speed measurement.
 */
export type SpeedMeasurementOptions = {
    /** Callback for progress updates during download */
    onProgress?: (info: ProgressInfo) => void;
    /** Sample size in bytes to use for speed measurement */
    sampleBytes?: number;
    /** Timeout in milliseconds for each URL test */
    timeoutMs?: number;
};

/**
 * Result of a URL speed test.
 */
export type UrlSpeedResult = {
    /** Time to first byte in milliseconds */
    latency: number;
    /** Download speed in bytes per second */
    speed: number;
    /** The URL that was tested */
    url: string;
};
