# 🐰 Rabbito

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/f64ff812-4fa4-4460-bd71-e97beb6fdc52.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/f64ff812-4fa4-4460-bd71-e97beb6fdc52)
[![Node.js CI](https://github.com/ragaeeb/rabbito/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/rabbito/actions/workflows/build.yml)
![GitHub License](https://img.shields.io/github/license/ragaeeb/rabbito)
![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/rabbito)
[![codecov](https://codecov.io/gh/ragaeeb/rabbito/graph/badge.svg?token=047RZEQVCC)](https://codecov.io/gh/ragaeeb/rabbito)
![0 Dependencies](https://img.shields.io/badge/dependencies-0-green)
[![Size](https://deno.bundlejs.com/badge?q=rabbito@latest)](https://bundlejs.com/?q=rabbito%40latest)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
![Types](https://img.shields.io/npm/types/rabbito)
![npm](https://img.shields.io/npm/v/rabbito)
![npm](https://img.shields.io/npm/dm/rabbito)
![GitHub issues](https://img.shields.io/github/issues/ragaeeb/rabbito)
![GitHub stars](https://img.shields.io/github/stars/ragaeeb/rabbito?style=social)
![Node & Bun](https://img.shields.io/badge/Works%20with-Node%20%26%20Bun-green)
![Maintenance](https://img.shields.io/maintenance/yes/2025)
[![npm version](https://img.shields.io/npm/v/rabbito.svg)](https://www.npmjs.com/package/rabbito)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A tiny, high-performance library to find the fastest download URL from a set of URLs. Rabbito automatically tests download speeds from multiple sources and returns the best option.

## Features

- 🚀 **Fast & Lightweight**: Minimal dependencies and optimized for performance
- ⚡ **Race-based Testing**: Tests multiple URLs concurrently and returns the fastest
- 🔄 **Smart Abortion**: Automatically cancels slower downloads once a faster one is found
- 🔌 **Environment Agnostic**: Works in both Node.js and Bun runtimes

## Installation

```bash
# Using npm
npm install rabbito

# Using yarn
yarn add rabbito

# Using pnpm
pnpm add rabbito

# Using bun
bun add rabbito
```

## Usage

### Finding the Fastest Download URL

```typescript
import { findBestDownloadUrl } from 'rabbito';

async function downloadFromFastestMirror() {
    const mirrors = [
        'https://mirror1.example.com/file.zip',
        'https://mirror2.example.com/file.zip',
        'https://mirror3.example.com/file.zip',
    ];

    try {
        // Find the fastest URL
        const fastestUrl = await findBestDownloadUrl(mirrors, {
            onUrlFailure: (url, error) => {
                console.error(`Failed to test ${url}:`, error);
            },
            sampleBytes: 128000, // Use smaller sample (128KB)
            timeoutMs: 10000, // 10 second timeout
            onProgress: (info) => {
                console.log(
                    `${info.url}: ${Math.round((info.bytesDownloaded / info.totalBytes) * 100)}% - ${Math.round(info.currentSpeed / 1024)} KB/s`,
                );
            },
        });

        console.log(`Fastest mirror found: ${fastestUrl}`);

        // Now you can use the fastest URL for your actual download
        const response = await fetch(fastestUrl);
        // Process the download...
    } catch (error) {
        console.error('All mirrors failed:', error);
    }
}

downloadFromFastestMirror();
```

### Checking URL Health

```typescript
import { checkUrlsHealth } from 'rabbito';

async function checkMirrors() {
    const mirrors = [
        'https://mirror1.example.com/file.zip',
        'https://mirror2.example.com/file.zip',
        'https://mirror3.example.com/file.zip',
    ];

    try {
        // Check if URLs are accessible
        const results = await checkUrlsHealth(mirrors, {
            timeoutMs: 5000, // 5 second timeout
            httpsOnly: true, // Only allow HTTPS URLs
        });

        // Filter healthy mirrors
        const healthyMirrors = results.filter((result) => result.healthy).map((result) => result.url);

        console.log(`Found ${healthyMirrors.length} healthy mirrors`);

        // Log errors for unhealthy mirrors
        const unhealthyMirrors = results.filter((result) => !result.healthy);
        if (unhealthyMirrors.length > 0) {
            console.log('Unhealthy mirrors:');
            unhealthyMirrors.forEach((result) => {
                console.log(`- ${result.url}: ${result.error}`);
            });
        }

        return healthyMirrors;
    } catch (error) {
        console.error('Failed to check mirrors:', error);
        return [];
    }
}

checkMirrors();
```

## API

### `findBestDownloadUrl(urls: string[], options?: FindBestDownloadUrlOptions): Promise<string>`

Tests the download speed of multiple URLs and returns the fastest one.

**Parameters:**

- `urls`: An array of URLs to test
- `options`: (Optional) Configuration options
    - `onUrlFailure`: Callback function that is invoked when a URL fails the speed test
    - `sampleBytes`: Size of data to download for testing (default: 256KB)
    - `timeoutMs`: Timeout for each URL test in milliseconds (default: 30000)
    - `maxConcurrent`: Maximum number of URLs to test concurrently
    - `earlyTerminationThreshold`: Threshold to stop testing if a clearly faster URL is found
    - `retries`: Number of times to retry failed URLs (default: 0)
    - `retryDelayMs`: Delay between retries in milliseconds (default: 1000)
    - `httpsOnly`: Whether to only allow HTTPS URLs (default: false)
    - `onProgress`: Callback for progress updates during download tests

**Returns:**

- A Promise that resolves to the URL string with the fastest download speed.

**Throws:**

- `Error` if all URLs fail the speed test

### `checkUrlsHealth(urls: string[], options?): Promise<Array<{url: string; healthy: boolean; error?: string}>>`

Checks if URLs are accessible without performing a full speed test.

**Parameters:**

- `urls`: An array of URLs to check
- `options`: (Optional) Configuration options
    - `timeoutMs`: Timeout for each URL check in milliseconds
    - `httpsOnly`: Whether to only allow HTTPS URLs (default: false)

**Returns:**

- A Promise that resolves to an array of objects containing:
    - `url`: The URL that was checked
    - `healthy`: Boolean indicating if the URL is accessible
    - `error`: Error message if the URL is not healthy (undefined otherwise)

## How It Works

Rabbito works by:

1. Initiating parallel fetch requests to all provided URLs
2. Downloading a small sample (~256KB) from each URL
3. Measuring the download speed for each URL
4. Canceling slower downloads once a faster one completes
5. Returning the URL with the best performance

This approach minimizes bandwidth usage while efficiently finding the optimal download source.

## Requirements

- Node.js >= 22.0.0 or Bun >= 1.2.11

## License

MIT © [Ragaeeb Haq](https://github.com/ragaeeb)
