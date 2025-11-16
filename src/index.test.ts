import { afterEach, beforeEach, describe, expect, it, jest, type Mock } from 'bun:test';

import { checkUrlsHealth, findBestDownloadUrl } from './index';

describe('index', () => {
    describe('findBestDownloadUrl', () => {
        // Setup mocks for fetch and ReadableStream
        const originalFetch = global.fetch;
        const originalReadableStream = global.ReadableStream;
        const originalAbortController = global.AbortController;
        const originalPerformance = global.performance;
        const originalAbortSignal = global.AbortSignal;

        // Mock data for tests
        const mockUrls = ['https://example.com/file1', 'https://example.com/file2', 'https://example.com/file3'];

        // Create mock implementations
        let mockReaders: { read: Mock<any>; releaseLock: jest.Mock<any> }[] = [];
        let mockAbortControllers: { abort: Mock<any>; signal: any }[] = [];
        let mockPerformanceNow: Mock<any>;
        let mockFetch: Mock<any>;

        beforeEach(() => {
            mockReaders = [];
            mockAbortControllers = [];

            // Mock performance.now to control timing
            mockPerformanceNow = jest.fn();
            mockPerformanceNow.mockReturnValueOnce(100); // Start time
            mockPerformanceNow.mockReturnValueOnce(125); // TTFB time for speed calculation
            mockPerformanceNow.mockReturnValueOnce(600); // End time (500ms elapsed)
            global.performance = { now: mockPerformanceNow } as any;

            // Mock AbortController
            mockAbortControllers = mockUrls.map(() => ({
                abort: jest.fn(),
                signal: { aborted: false },
            }));

            // Mock single controller creation
            let controllerIndex = 0;
            global.AbortController = jest.fn().mockImplementation(() => {
                const controller = mockAbortControllers[controllerIndex % mockAbortControllers.length];
                controllerIndex++;
                return controller;
            }) as any;

            // Mock AbortSignal.any
            global.AbortSignal = {
                ...global.AbortSignal,
                any: jest.fn().mockImplementation((signals) => signals[0]),
            } as any;

            // Mock fetch responses
            mockFetch = jest.fn();
            global.fetch = mockFetch as any;
        });

        afterEach(() => {
            // Restore all mocks
            global.fetch = originalFetch;
            global.ReadableStream = originalReadableStream;
            global.AbortController = originalAbortController;
            global.performance = originalPerformance;
            global.AbortSignal = originalAbortSignal;
        });

        it('should throw an error when all URLs fail', async () => {
            // Make all fetch calls fail
            mockFetch.mockImplementation(() => {
                return Promise.resolve({
                    body: null,
                    ok: false,
                    status: 404,
                });
            });

            // Check that it throws the appropriate error
            await expect(findBestDownloadUrl(mockUrls)).rejects.toThrow('All speed tests failed');
        });

        it('should call onUrlFailure when a URL fails', async () => {
            // First URL succeeds
            mockReaders.push({
                read: jest.fn().mockResolvedValue({
                    done: false,
                    value: new Uint8Array(256000), // Full 256KB in one go
                }),
                releaseLock: jest.fn(),
            });

            // Mock fetch with success for first URL and failure for others
            mockFetch.mockImplementation((url: string) => {
                if (url === mockUrls[0]) {
                    return Promise.resolve({
                        body: {
                            getReader: () => mockReaders[0],
                        },
                        ok: true,
                        status: 200,
                    });
                } else {
                    return Promise.resolve({
                        body: null,
                        ok: false,
                        status: 404,
                    });
                }
            });

            // Create a spy for the onUrlFailure callback
            const onUrlFailure = jest.fn();

            // Execute with the callback
            const result = await findBestDownloadUrl(mockUrls, { onUrlFailure });

            // The callback should be called for the failed URLs
            expect(onUrlFailure).toHaveBeenCalledTimes(2);
            expect(onUrlFailure).toHaveBeenCalledWith(mockUrls[1], expect.any(Error));
            expect(onUrlFailure).toHaveBeenCalledWith(mockUrls[2], expect.any(Error));

            // The result should be the working URL
            expect(result).toBe(mockUrls[0]);
        });

        it('should handle slow networks by continuing to download until sample size is reached', async () => {
            // Setup a reader that returns data in small chunks (simulating slow network)
            const smallChunkReader = {
                read: jest.fn(),
                releaseLock: jest.fn(),
            };

            // Return 10 small chunks of 25.6KB each to reach 256KB sample
            for (let i = 0; i < 10; i++) {
                smallChunkReader.read.mockResolvedValueOnce({
                    done: i === 9, // Last chunk
                    value: new Uint8Array(25600), // 25.6KB chunks
                });
            }

            mockReaders.push(smallChunkReader);

            // Mock successful fetch
            mockFetch.mockImplementation(() => {
                return Promise.resolve({
                    body: {
                        getReader: () => mockReaders[0],
                    },
                    ok: true,
                    status: 200,
                });
            });

            // Run the test with just one URL
            const result = await findBestDownloadUrl([mockUrls[0]]);

            // Verify that read was called multiple times to accumulate the sample size
            expect(smallChunkReader.read).toHaveBeenCalledTimes(10);
            expect(result).toBe(mockUrls[0]);
        });

        it('should handle early completion before sample size is reached', async () => {
            // Setup a reader that returns less data than the sample size and then completes
            const earlyCompleteReader = {
                read: jest
                    .fn()
                    .mockResolvedValueOnce({ done: false, value: new Uint8Array(100000) }) // 100KB
                    .mockResolvedValueOnce({ done: true, value: undefined }), // Stream ends early
                releaseLock: jest.fn(),
            };

            mockReaders.push(earlyCompleteReader);

            // Mock successful fetch
            mockFetch.mockImplementation(() => {
                return Promise.resolve({
                    body: {
                        getReader: () => mockReaders[0],
                    },
                    ok: true,
                    status: 200,
                });
            });

            // Should complete successfully despite not reaching sample size
            const result = await findBestDownloadUrl([mockUrls[0]]);

            expect(earlyCompleteReader.read).toHaveBeenCalledTimes(2);
            expect(result).toBe(mockUrls[0]);
        });

        it('should validate URLs when httpsOnly is set', async () => {
            // Setup URLs with different protocols
            const mixedUrls = ['http://example.com/file1', 'https://example.com/file2', 'ftp://example.com/file3'];

            // Create successful reader for HTTPS URL
            mockReaders.push({
                read: jest.fn().mockResolvedValue({
                    done: false,
                    value: new Uint8Array(256000),
                }),
                releaseLock: jest.fn(),
            });

            // Mock successful fetch for the HTTPS URL
            mockFetch.mockImplementation((url) => {
                if (url === mixedUrls[1]) {
                    return Promise.resolve({
                        body: {
                            getReader: () => mockReaders[0],
                        },
                        ok: true,
                        status: 200,
                    });
                }
                return Promise.resolve({ ok: false });
            });

            // Test with httpsOnly option
            const result = await findBestDownloadUrl(mixedUrls, { httpsOnly: true });

            // Should only use the HTTPS URL
            expect(result).toBe(mixedUrls[1]);
            // Fetch should only be called for the HTTPS URL (index 1)
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toBe(mixedUrls[1]);
        });
    });
    describe('checkUrlsHealth', () => {
        const originalFetch = global.fetch;

        beforeEach(() => {
            global.fetch = jest.fn() as any;
        });

        afterEach(() => {
            global.fetch = originalFetch;
            jest.useRealTimers();
        });

        it('returns health information for each reachable URL', async () => {
            (global.fetch as Mock).mockImplementation((url: string) => {
                if (url.includes('unhealthy')) {
                    return Promise.resolve({ ok: false, status: 500 });
                }

                return Promise.resolve({ ok: true, status: 200 });
            });

            const results = await checkUrlsHealth([
                'https://healthy.example.com/file.zip',
                'https://unhealthy.example.com/file.zip',
            ]);

            expect(results).toEqual([
                { error: undefined, healthy: true, url: 'https://healthy.example.com/file.zip' },
                { error: 'HTTP 500', healthy: false, url: 'https://unhealthy.example.com/file.zip' },
            ]);
        });

        it('omits invalid URLs when httpsOnly is enabled', async () => {
            (global.fetch as Mock).mockResolvedValue({ ok: true, status: 200 });

            const results = await checkUrlsHealth([
                'http://insecure.example.com/file.zip',
                'https://secure.example.com/file.zip',
                'notaurl',
            ], {
                httpsOnly: true,
            });

            expect((global.fetch as Mock).mock.calls).toHaveLength(1);
            expect((global.fetch as Mock).mock.calls[0][0]).toBe('https://secure.example.com/file.zip');
            expect(results).toEqual([
                { error: undefined, healthy: true, url: 'https://secure.example.com/file.zip' },
            ]);
        });

        it('marks URLs unhealthy when the request times out', async () => {
            (global.fetch as Mock).mockImplementation((_url: string, init: RequestInit) => {
                return new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const abortError = new Error('aborted');
                        (abortError as Error & { name: string }).name = 'AbortError';
                        reject(abortError);
                    });
                });
            });

            const promise = checkUrlsHealth(['https://timeout.example.com/file.zip'], { timeoutMs: 1 });

            await expect(promise).resolves.toEqual([
                { error: 'aborted', healthy: false, url: 'https://timeout.example.com/file.zip' },
            ]);
        });
    });
});
