const SAMPLE_BYTES = 256_000; // bytes to download to test speed (~256 KB)

const measureDownloadSpeed = async (url: string, signal: AbortSignal): Promise<{ speed: number; url: string }> => {
    const start = performance.now();
    const response = await fetch(url, { signal });

    if (!response.ok || !response.body) {
        throw new Error(`Failed: ${url}`);
    }

    const reader = response.body.getReader();
    let totalBytes = 0;

    while (totalBytes < SAMPLE_BYTES) {
        const { done, value } = await reader.read();

        if (done || !value) {
            break;
        }

        totalBytes += value.byteLength;
    }

    const duration = (performance.now() - start) / 1000; // seconds
    const speed = totalBytes / duration; // bytes/sec
    return { speed, url };
};

type FindBestDownloadUrlOptions = {
    onUrlFailure(url: string, err: any): void;
};

export const findBestDownloadUrl = async (urls: string[], options?: FindBestDownloadUrlOptions): Promise<string> => {
    const controllers = urls.map(() => new AbortController());

    const speedTests = urls.map((url, index) => {
        const signal = controllers[index].signal;
        return measureDownloadSpeed(url, signal)
            .then((result) => {
                // Abort other fetches on first successful result
                controllers.forEach((controller, i) => {
                    if (i !== index) {
                        controller.abort();
                    }
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

    const result = await Promise.any(
        speedTests.map((p) =>
            p.then((res) => {
                if (!res) {
                    throw new Error('Failed'); // force rejection of nulls
                }

                return res;
            }),
        ),
    ).catch(() => {
        throw new Error('All speed tests failed');
    });

    return result.url;
};
