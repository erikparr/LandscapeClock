/**
 * fluxImageGenerator.js
 *
 * FLUX.1 Fill integration for generating daily landscape panoramas
 * Uses Replicate API instead of local Stable Diffusion
 */

import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Creates a fixed mask for outpainting to the right
 * For a 768x512 canvas where original 512x512 is on the left:
 * - Left 512px: BLACK (preserve original)
 * - Right 256px: WHITE (generate new content)
 *
 * @returns {Promise<Buffer>} PNG buffer of the mask image (768x512)
 */
async function createOutpaintMask() {
    const width = 768;   // Extended canvas width
    const height = 512;
    const preserveWidth = 512;  // Original image width to preserve

    const maskData = Buffer.alloc(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (x < preserveWidth) {
                // Left 512px: preserve (black)
                maskData[idx] = 0;
            } else {
                // Right 256px: paint (white)
                maskData[idx] = 255;
            }
        }
    }

    // Convert raw data to PNG using sharp
    const maskBuffer = await sharp(maskData, {
        raw: {
            width: width,
            height: height,
            channels: 1
        }
    })
    .png()
    .toBuffer();

    return maskBuffer;
}

/**
 * Generates a full day landscape by extending an image 24 times using FLUX.1 Fill
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

    console.log(`Starting FLUX.1 Fill generation for ${date}`);
    console.log(`Using outpaint approach: 512x512 → 768x512 (extend right 256px)`);
    console.log(`Total segments to generate: ${prompts.length}`);

    const numSegments = prompts.length;

    // Create the fixed mask once (768x512: left 512px black, right 256px white)
    const maskBuffer = await createOutpaintMask();
    const maskDataUrl = `data:image/png;base64,${maskBuffer.toString('base64')}`;

    // Save mask for debugging (only once)
    const debugMaskPath = path.join(outputDir, `outpaint_mask.png`);
    await fs.writeFile(debugMaskPath, maskBuffer);
    console.log(`Outpaint mask saved: ${debugMaskPath}`);

    for (let i = 0; i < numSegments; i++) {
        console.log(`\nGenerating segment ${i + 1}/${prompts.length}`);
        console.log(`Prompt: ${prompts[i]}`);

        try {
            // Read the current image (must be 512x512)
            const imageBuffer = await fs.readFile(currentImagePath);
            const metadata = await sharp(imageBuffer).metadata();

            console.log(`Seed image: ${metadata.width}x${metadata.height}`);

            if (metadata.width !== 512 || metadata.height !== 512) {
                throw new Error(`Input image must be 512x512, got ${metadata.width}x${metadata.height}`);
            }

            // Step 1: Create 768x512 canvas with seed on left, white space on right
            const canvasBuffer = await sharp({
                create: {
                    width: 768,
                    height: 512,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
            .composite([{
                input: imageBuffer,
                left: 0,
                top: 0
            }])
            .png()
            .toBuffer();

            // Convert canvas and mask to base64
            const canvasDataUrl = `data:image/png;base64,${canvasBuffer.toString('base64')}`;

            // Step 2: Call FLUX.1 Fill with 768x512 canvas + 768x512 mask
            console.log(`Calling FLUX: 768x512 canvas (preserve left 512px, generate right 256px)...`);
            const output = await replicate.run(
                "black-forest-labs/flux-fill-pro",
                {
                    input: {
                        image: canvasDataUrl,
                        mask: maskDataUrl,
                        prompt: prompts[i],
                        output_format: "png",
                        safety_tolerance: 2,
                        prompt_upsampling: false,
                        guidance: 30,
                        steps: 28
                    }
                }
            );

            // Download the extended image
            const extendedImageUrl = output;
            const response = await fetch(extendedImageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Save the full extended image (should be 768x512)
            const segmentPath = path.join(outputDir, `${date}_segment_${i.toString().padStart(2, '0')}.png`);
            await fs.writeFile(segmentPath, buffer);
            segmentPaths.push(segmentPath);

            const resultMeta = await sharp(buffer).metadata();
            console.log(`Saved segment: ${segmentPath} (${resultMeta.width}x${resultMeta.height})`);

            // Step 3: Crop rightmost 512px for next iteration
            const croppedPath = path.join(outputDir, `${date}_seed_${i + 1}.png`);
            await sharp(buffer)
                .extract({
                    width: 512,
                    height: 512,
                    left: resultMeta.width - 512,
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
 * Each segment is 768x512 but we only use:
 * - First segment: full 768px
 * - Subsequent segments: rightmost 256px only (to avoid overlap)
 *
 * @param {string[]} imagePaths - Array of image paths to stitch
 * @param {string} outputDir - Output directory
 * @param {string} date - Date string for file naming
 * @returns {Promise<string>} Path to the stitched image
 */
async function stitchImages(imagePaths, outputDir, date) {
    const EXTENSION_WIDTH = 256; // Only new content from each segment
    const FIRST_SEGMENT_WIDTH = 768; // Full width of first segment

    // Calculate final dimensions
    const numSegments = imagePaths.length;
    const totalWidth = FIRST_SEGMENT_WIDTH + (numSegments - 1) * EXTENSION_WIDTH;
    const height = 512;

    console.log(`Stitching ${numSegments} segments: final size ${totalWidth}x${height}`);

    // Create composite operations
    const compositeOps = [];
    let xOffset = 0;

    for (let i = 0; i < imagePaths.length; i++) {
        if (i === 0) {
            // First segment: use full 768px
            compositeOps.push({
                input: imagePaths[i],
                left: xOffset,
                top: 0
            });
            xOffset += FIRST_SEGMENT_WIDTH;
        } else {
            // Subsequent segments: only use rightmost 256px
            const croppedBuffer = await sharp(imagePaths[i])
                .extract({
                    width: EXTENSION_WIDTH,
                    height: height,
                    left: 512, // Skip the overlapping 512px, take only the new 256px
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
