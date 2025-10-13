/**
 * sdxlInpaintingGenerator.js
 *
 * SDXL Inpainting integration for generating daily landscape panoramas
 * Uses Replicate API with lucataco/sdxl-inpainting model
 * Uses explicit mask-based approach for controlled outpainting
 */

import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Creates a mask for inpainting that preserves left portion and paints right portion
 * Black (0) = preserve, White (255) = paint
 * @param {number} totalWidth - Total width of the canvas
 * @param {number} height - Height of the canvas
 * @param {number} preserveWidth - Width to preserve (left side, black)
 * @returns {Promise<Buffer>} PNG mask buffer
 */
async function createInpaintMask(totalWidth, height, preserveWidth) {
    // Create grayscale mask data
    const maskData = Buffer.alloc(totalWidth * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < totalWidth; x++) {
            const idx = y * totalWidth + x;
            if (x < preserveWidth) {
                maskData[idx] = 0;    // Left portion: preserve (black)
            } else {
                maskData[idx] = 255;  // Right portion: paint (white)
            }
        }
    }

    // Convert raw grayscale data to PNG
    return await sharp(maskData, {
        raw: {
            width: totalWidth,
            height: height,
            channels: 1
        }
    })
    .png()
    .toBuffer();
}

/**
 * Creates an extended canvas with the seed image on the left and blank space on the right
 * @param {Buffer} seedBuffer - The seed image buffer
 * @param {number} seedWidth - Width of seed image
 * @param {number} height - Height of image
 * @param {number} extensionWidth - Width to extend (blank space on right)
 * @returns {Promise<Buffer>} Extended canvas buffer
 */
async function createExtendedCanvas(seedBuffer, seedWidth, height, extensionWidth) {
    const totalWidth = seedWidth + extensionWidth;

    return await sharp({
        create: {
            width: totalWidth,
            height: height,
            channels: 3,
            background: { r: 128, g: 128, b: 128 } // Neutral gray for extension area
        }
    })
    .composite([{
        input: seedBuffer,
        left: 0,
        top: 0
    }])
    .png()
    .toBuffer();
}

/**
 * Generates a full day landscape by extending an image 24 times using SDXL Inpainting
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

    console.log(`Starting SDXL Inpainting generation for ${date}`);
    console.log(`Using mask-based approach: preserve left, paint right extension`);
    console.log(`Total segments to generate: ${prompts.length}`);

    const INPAINT_WIDTH = 256; // Width of area to inpaint on right side
    const PRESERVE_WIDTH = 256; // Width of area to preserve on left side (256px for overlap)
    const CANVAS_SIZE = 512; // Always use 512x512 canvas

    for (let i = 0; i < prompts.length; i++) {
        console.log(`\nGenerating segment ${i + 1}/${prompts.length}`);
        console.log(`Prompt: ${prompts[i]}`);

        try {
            // Read the current image
            const imageBuffer = await fs.readFile(currentImagePath);
            const metadata = await sharp(imageBuffer).metadata();
            const height = metadata.height;

            console.log(`Seed image: ${metadata.width}x${height}`);

            // Crop rightmost 256px of seed to place on left of canvas
            const leftPortion = await sharp(imageBuffer)
                .extract({
                    width: PRESERVE_WIDTH,
                    height: height,
                    left: Math.max(0, metadata.width - PRESERVE_WIDTH),
                    top: 0
                })
                .toBuffer();

            // Create 512x512 canvas with left 256px from seed, right 256px blank
            const extendedCanvas = await createExtendedCanvas(
                leftPortion,
                PRESERVE_WIDTH,
                height,
                INPAINT_WIDTH
            );

            // Create mask: preserve left 256px (black), paint right 256px (white)
            const mask = await createInpaintMask(
                CANVAS_SIZE,
                height,
                PRESERVE_WIDTH
            );

            // Convert to data URLs
            const canvasDataUrl = `data:image/png;base64,${extendedCanvas.toString('base64')}`;
            const maskDataUrl = `data:image/png;base64,${mask.toString('base64')}`;

            // Call SDXL Inpainting model
            console.log(`Calling SDXL Inpainting: extend right by ${INPAINT_WIDTH}px...`);
            let output;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount <= maxRetries) {
                try {
                    output = await replicate.run(
                        "lucataco/sdxl-inpainting:a5b13068cc81a89a4fbeefeccc774869fcb34df4dbc92c1555e0f2771d49dde7",
                        {
                            input: {
                                image: canvasDataUrl,
                                mask: maskDataUrl,
                                prompt: prompts[i],
                                negative_prompt: "blurry, distorted, low quality, artifacts, inconsistent lighting, discontinuous, fragmented",
                                guidance_scale: 8,
                                steps: 50,
                                strength: 0.95,
                                scheduler: "K_EULER"
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

            // Download the extended image
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

            // Use the full 512x512 result as next seed
            const seedPath = path.join(outputDir, `${date}_seed_${i + 1}.png`);
            await fs.writeFile(seedPath, buffer);

            currentImagePath = seedPath;
            console.log(`Next seed prepared: ${seedPath} (${resultMeta.width}x${resultMeta.height})`);

        } catch (error) {
            console.error(`Error generating segment ${i + 1}:`, error);
            throw new Error(`Failed to generate segment ${i + 1}: ${error.message}`);
        }
    }

    // Stitch all segments together horizontally
    console.log('\nStitching segments together...');
    const fullDayPath = await stitchImages(segmentPaths, outputDir, date, INPAINT_WIDTH);

    // Clean up intermediate seed images
    console.log('Cleaning up intermediate files...');
    for (let i = 1; i <= prompts.length; i++) {
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
 * First segment uses full width, subsequent segments only add the extended portion
 *
 * @param {string[]} imagePaths - Array of image paths to stitch
 * @param {string} outputDir - Output directory
 * @param {string} date - Date string for file naming
 * @param {number} extensionWidth - Width of the extended portion per segment
 * @returns {Promise<string>} Path to the stitched image
 */
async function stitchImages(imagePaths, outputDir, date, extensionWidth) {
    // Read first image to get dimensions
    const firstImageMeta = await sharp(imagePaths[0]).metadata();
    const height = firstImageMeta.height;

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
            // Subsequent segments: only use the rightmost extension portion
            const croppedBuffer = await sharp(imagePaths[i])
                .extract({
                    width: extensionWidth,
                    height: height,
                    left: currentMeta.width - extensionWidth,
                    top: 0
                })
                .toBuffer();

            compositeOps.push({
                input: croppedBuffer,
                left: xOffset,
                top: 0
            });
            xOffset += extensionWidth;
        }
    }

    const totalWidth = xOffset;
    console.log(`Stitching ${imagePaths.length} segments: final size ${totalWidth}x${height}`);

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
