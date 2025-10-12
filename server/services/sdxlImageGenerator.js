/**
 * sdxlImageGenerator.js
 *
 * SDXL Inpainting integration for generating daily landscape panoramas
 * Uses Replicate API with lucataco/sdxl-inpainting model
 * Uses canvas + mask approach similar to FLUX for consistent outpainting
 */

import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Creates a 768x512 mask for outpainting
 * Left 512px: black (preserve original)
 * Right 256px: white (paint new content)
 * @returns {Promise<Buffer>} PNG mask buffer
 */
async function createOutpaintMask() {
    const width = 768;   // Extended canvas width
    const height = 512;
    const preserveWidth = 512;  // Original image width to preserve

    // Create grayscale mask data
    const maskData = Buffer.alloc(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (x < preserveWidth) {
                maskData[idx] = 0;    // Left 512px: preserve (black)
            } else {
                maskData[idx] = 255;  // Right 256px: paint (white)
            }
        }
    }

    // Convert raw grayscale data to PNG
    return await sharp(maskData, {
        raw: {
            width: width,
            height: height,
            channels: 1
        }
    })
    .png()
    .toBuffer();
}

/**
 * Generates a full day landscape by extending an image 24 times using SDXL Outpainting
 * @param {string} seedImagePath - Path to the initial seed image
 * @param {string[]} prompts - Array of 24 prompts, one for each hour
 * @param {string} outputDir - Directory to save generated images
 * @param {string} date - Date string for file naming
 * @returns {Promise<string>} Path to the final full-day landscape image
 */
export async function generateDailyLandscape(seedImagePath, prompts, outputDir, date) {
    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
    });

    if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error('REPLICATE_API_TOKEN environment variable is not set');
    }

    await fs.ensureDir(outputDir);

    let currentImagePath = seedImagePath;
    const segmentPaths = [];

    console.log(`Starting SDXL Outpainting generation for ${date}`);
    console.log(`Using outpaint approach: extend right by 256px each iteration`);
    console.log(`Total segments to generate: ${prompts.length}`);

    const numSegments = prompts.length;

    for (let i = 0; i < numSegments; i++) {
        console.log(`\nGenerating segment ${i + 1}/${prompts.length}`);
        console.log(`Prompt: ${prompts[i]}`);

        try {
            // Read the current image
            const imageBuffer = await fs.readFile(currentImagePath);
            const metadata = await sharp(imageBuffer).metadata();

            console.log(`Seed image: ${metadata.width}x${metadata.height}`);

            // Convert image to data URL
            const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

            // Call SDXL Outpainting model - with retry on NSFW false positives
            console.log(`Calling SDXL Outpainting: extend right by 512px...`);
            let output;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    output = await replicate.run(
                        "fermatresearch/sdxl-outpainting-lora:a542ccf352995f3c41f0bcfaef641daa3058bf2b00e08e04feb0295334ab9804",
                        {
                            input: {
                                image: imageDataUrl,
                                prompt: prompts[i],
                                negative_prompt: "abstraction, blurry, surreal patterns, text, logos",
                                outpaint_right: 256,
                                outpaint_left: 0,
                                outpaint_up: 0,
                                outpaint_down: 0,
                                condition_scale: 1,
                                guidance_scale: 3.5,
                            }
                        }
                    );
                    break; // Success, exit retry loop
                } catch (err) {
                    if (err.message && err.message.includes('NSFW content detected')) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            console.log(`NSFW false positive detected. Retry ${retryCount}/${maxRetries}...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else {
                            throw new Error(`NSFW filter triggered ${maxRetries} times. Skipping segment.`);
                        }
                    } else {
                        throw err;
                    }
                }
            }

            // Download the extended image (output is an array)
            const extendedImageUrl = Array.isArray(output) ? output[0] : output;
            const response = await fetch(extendedImageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Save the full extended image
            const segmentPath = path.join(outputDir, `${date}_segment_${i.toString().padStart(2, '0')}.png`);
            await fs.writeFile(segmentPath, buffer);
            segmentPaths.push(segmentPath);

            const resultMeta = await sharp(buffer).metadata();
            console.log(`Saved segment: ${segmentPath} (${resultMeta.width}x${resultMeta.height})`);

            // Crop rightmost 768px for next iteration seed (full 512px + 256px extension overlap)
            const croppedPath = path.join(outputDir, `${date}_seed_${i + 1}.png`);
            const cropWidth = Math.min(768, resultMeta.width);
            await sharp(buffer)
                .extract({
                    width: cropWidth,
                    height: 512,
                    left: Math.max(0, resultMeta.width - cropWidth),
                    top: 0
                })
                .toFile(croppedPath);

            currentImagePath = croppedPath;
            console.log(`Next seed prepared: ${croppedPath}`);

        } catch (error) {
            console.error(`Error generating segment ${i + 1}:`, error);
            throw new Error(`Failed to generate segment ${i + 1}: ${error.message}`);
        }
    }

    // Stitch all segments together horizontally
    console.log('\nStitching segments together...');
    const fullDayPath = await stitchImages(segmentPaths, outputDir, date);

    // Clean up intermediate seed images
    console.log('Cleaning up intermediate files...');
    for (let i = 1; i < prompts.length; i++) {
        const seedPath = path.join(outputDir, `${date}_seed_${i}.png`);
        if (await fs.pathExists(seedPath)) {
            await fs.remove(seedPath);
        }
    }

    console.log(`Full day landscape generated: ${fullDayPath}`);
    return fullDayPath;
}

/**
 * Stitches multiple image segments into a single panorama
 * Strategy: Use first segment fully, then only add new content from each subsequent segment
 * Note: SDXL outputs 1024x512 images (not 768x512), so we extract the rightmost 512px from each
 *
 * @param {string[]} imagePaths - Array of image paths to stitch
 * @param {string} outputDir - Output directory
 * @param {string} date - Date string for file naming
 * @returns {Promise<string>} Path to the stitched image
 */
async function stitchImages(imagePaths, outputDir, date) {
    // Read first image to get actual dimensions
    const firstImageMeta = await sharp(imagePaths[0]).metadata();
    const height = firstImageMeta.height;

    // SDXL outputs 1024x512, so new content is rightmost 512px
    const EXTENSION_WIDTH = 512;

    console.log(`First segment: ${firstImageMeta.width}x${firstImageMeta.height}`);

    // Create composite operations
    const compositeOps = [];
    let xOffset = 0;

    for (let i = 0; i < imagePaths.length; i++) {
        const currentMeta = await sharp(imagePaths[i]).metadata();

        if (i === 0) {
            // First segment: use full width
            compositeOps.push({
                input: imagePaths[i],
                left: xOffset,
                top: 0
            });
            xOffset += currentMeta.width;
        } else {
            // Subsequent segments: only use rightmost 512px (the new content)
            const overlapWidth = currentMeta.width - EXTENSION_WIDTH;
            const croppedBuffer = await sharp(imagePaths[i])
                .extract({
                    width: EXTENSION_WIDTH,
                    height: height,
                    left: overlapWidth, // Skip the overlapping portion
                    top: 0
                })
                .toBuffer();

            compositeOps.push({
                input: croppedBuffer,
                left: xOffset,
                top: 0
            });
            xOffset += EXTENSION_WIDTH;
        }
    }

    const numSegments = imagePaths.length;
    const totalWidth = xOffset;
    console.log(`Stitching ${numSegments} segments: final size ${totalWidth}x${height}`);

    const stitchedPath = path.join(outputDir, `${date}_full_day_landscape.png`);

    await sharp({
        create: {
            width: totalWidth,
            height: height,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
    .composite(compositeOps)
    .toFile(stitchedPath);

    console.log(`Stitched panorama: ${totalWidth}x${height}`);
    return stitchedPath;
}
