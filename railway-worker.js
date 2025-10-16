/**
 * Railway Worker - Background image generation service
 *
 * This runs as a standalone service on Railway that:
 * 1. Generates daily landscapes at 5 PM
 * 2. Uploads to Vercel Blob storage
 * 3. Maintains multi-day continuity
 */

import 'dotenv/config';
import { scheduleJob } from 'node-schedule';
import { generateDailyPrompts, savePromptsToFile } from './server/services/promptGenerator.js';
import { generateDailyLandscape } from './server/services/stabilitySDInpaintingGenerator.js';
import { put } from '@vercel/blob';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default fallback values
const defaultSeedPath = path.join(__dirname, 'static/images/input.jpg');
const defaultDescription = "a natural landscape with mountains, turquoise lake and pine forests at dawn";

console.log('🚂 Railway Worker Starting...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Timezone: ${process.env.TZ || 'UTC'}`);

/**
 * Download blob to local temp file
 */
async function downloadBlob(url, localPath) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download blob: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));
}

/**
 * Check if previous day's continuity files exist in Vercel Blob
 */
async function loadPreviousDayOutputs(targetDate) {
    const previousDay = new Date(targetDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDate = previousDay.toISOString().split('T')[0];

    console.log('Checking for previous day outputs...');
    console.log(`  Previous date: ${previousDate}`);

    try {
        // Use Vercel Blob list() API to find files by pathname
        const { list } = await import('@vercel/blob');
        const { blobs } = await list({
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        console.log(`  Found ${blobs.length} total blobs in storage`);

        // Find previous day's continuity files
        const prevSeedBlob = blobs.find(blob =>
            blob.pathname.includes(`${previousDate}_final_seed`)
        );
        const prevDescBlob = blobs.find(blob =>
            blob.pathname.includes(`${previousDate}_final_description`)
        );

        console.log(`  Previous seed blob: ${prevSeedBlob ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`  Previous description blob: ${prevDescBlob ? 'FOUND' : 'NOT FOUND'}`);

        if (prevSeedBlob && prevDescBlob) {
            // Download previous day's final description
            const descResponse = await fetch(prevDescBlob.url);
            if (!descResponse.ok) {
                throw new Error(`Failed to fetch description: ${descResponse.statusText}`);
            }
            const previousDescription = await descResponse.text();

            // Download previous day's final seed to temp location
            const tempSeedPath = path.join(__dirname, 'temp_seed.png');
            await downloadBlob(prevSeedBlob.url, tempSeedPath);

            console.log('✅ CONTINUITY MODE: Previous day outputs found');
            console.log(`   Seed URL: ${prevSeedBlob.url}`);
            console.log(`   Description URL: ${prevDescBlob.url}`);
            console.log(`   Final description: "${previousDescription.substring(0, 80)}..."`);

            return {
                seedImagePath: tempSeedPath,
                initialDescription: previousDescription.trim(),
                hasContinuity: true
            };
        }
    } catch (error) {
        console.log('⚠️  Error checking previous day outputs:', error.message);
    }

    console.log('🆕 FRESH START: Using default seed and description');
    return {
        seedImagePath: defaultSeedPath,
        initialDescription: defaultDescription,
        hasContinuity: false
    };
}

/**
 * Upload generated files to Vercel Blob
 */
async function uploadToBlob(localPath, blobName) {
    const fileBuffer = await fs.readFile(localPath);
    const blob = await put(blobName, fileBuffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log(`  ✅ Uploaded to blob: ${blob.url}`);
    return blob.url;
}

/**
 * Generate and upload daily landscape
 */
async function generateAndUploadLandscape() {
    const targetDate = new Date().toISOString().split('T')[0];
    const outputDir = path.join(__dirname, `temp-generation-${targetDate}`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  Generating Landscape: ${targetDate}`);
    console.log('═══════════════════════════════════════════════════════\n');

    try {
        // Load previous day's outputs for continuity
        const { seedImagePath, initialDescription, hasContinuity } = await loadPreviousDayOutputs(targetDate);

        // Ensure temp directory exists
        await fs.ensureDir(outputDir);

        console.log('STEP 1: Generating prompts...');
        const prompts = await generateDailyPrompts(initialDescription, new Date(targetDate));

        const promptsFile = path.join(outputDir, `${targetDate}_prompts.txt`);
        await savePromptsToFile(prompts, promptsFile);

        console.log('\nSTEP 2: Generating panorama...');
        const result = await generateDailyLandscape(seedImagePath, prompts, outputDir, targetDate);

        console.log('\nSTEP 3: Uploading to Vercel Blob...');

        // Upload panorama
        const panoramaUrl = await uploadToBlob(
            result.fullDayPath,
            `${targetDate}_full_day_landscape.png`
        );

        // Upload final seed for next day
        const finalSeedUrl = await uploadToBlob(
            result.finalSeedPath,
            `${targetDate}_final_seed.png`
        );

        // Upload final description for next day
        const finalDescPath = path.join(outputDir, `${targetDate}_final_description.txt`);
        await fs.writeFile(finalDescPath, result.finalDescription, 'utf-8');
        const finalDescUrl = await uploadToBlob(
            finalDescPath,
            `${targetDate}_final_description.txt`
        );

        // Upload prompts
        const promptsUrl = await uploadToBlob(
            promptsFile,
            `${targetDate}_prompts.txt`
        );

        console.log('\n✅ Generation complete!');
        console.log(`  Panorama: ${panoramaUrl}`);
        console.log(`  Final seed: ${finalSeedUrl}`);
        console.log(`  Final description: ${finalDescUrl}`);
        console.log(`  Prompts: ${promptsUrl}`);
        console.log(`  Continuity: ${hasContinuity ? 'Yes' : 'No (fresh start)'}`);

        // Clean up temp directory
        await fs.remove(outputDir);
        console.log('  Cleaned up temp files');

        return {
            success: true,
            panoramaUrl,
            date: targetDate
        };

    } catch (error) {
        console.error('❌ Generation failed:', error);
        console.error(error.stack);

        // Clean up on error
        await fs.remove(outputDir).catch(() => {});

        return {
            success: false,
            error: error.message
        };
    }
}

// Schedule generation at 5 PM daily (adjust timezone as needed)
scheduleJob('0 17 * * *', async function() {
    console.log('\n🕔 Scheduled generation triggered at 5 PM');
    await generateAndUploadLandscape();
});

// Also run on startup for testing (can remove in production)
if (process.env.RUN_ON_STARTUP === 'true') {
    console.log('🚀 Running initial generation on startup...');
    generateAndUploadLandscape().then(() => {
        console.log('Initial generation complete. Now waiting for scheduled runs...');
    });
}

// Keep process alive
console.log('✅ Worker ready. Waiting for scheduled jobs...');
console.log('   Next run: Every day at 5 PM');

// Health check endpoint (optional)
import http from 'http';
const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            service: 'landscape-worker',
            nextRun: '17:00 daily'
        }));
    } else if (req.url === '/generate-now') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'triggered' }));
        generateAndUploadLandscape();
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
    console.log(`   GET /health - Check worker status`);
    console.log(`   GET /generate-now - Trigger generation manually`);
});
