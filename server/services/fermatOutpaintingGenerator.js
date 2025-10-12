/**
 * fermatOutpaintingGenerator.js
 *
 * Fermat SDXL Outpainting LoRA integration for generating daily landscape panoramas
 * Uses fermatresearch/sdxl-outpainting-lora model
 */

import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

/**
 * Generates a full day landscape by extending an image using Fermat SDXL Outpainting
 * @param {string} seedImagePath - Path to the initial seed image
 * @param {string[]} prompts - Array of prompts
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

    console.log(`Starting Fermat SDXL Outpainting generation for ${date}`);
    console.log(`Using outpainting approach: extend right by 256px each iteration`);
    console.log(`Total segments to generate: ${prompts.length}`);

    const EXTENSION_WIDTH = 256; // Extend by 256px each iteration

    for (let i = 0; i < prompts.length; i++) {
        console.log(`\nGenerating segment ${i + 1}/${prompts.length}`);
        console.log(`Prompt: ${prompts[i]}`);

        try {
            // Read the current image
            const imageBuffer = await fs.readFile(currentImagePath);
            const metadata = await sharp(imageBuffer).metadata();

            console.log(`Seed image: ${metadata.width}x${metadata.height}`);

            // Convert image to data URL
            const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

            // Call Fermat SDXL Outpainting
            console.log(`Calling Fermat SDXL Outpainting: extend right by ${EXTENSION_WIDTH}px...`);
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
                                outpaint_left: 0,
                                outpaint_right: EXTENSION_WIDTH,
                                outpaint_up: 0,
                                outpaint_down: 0,
                                guidance_scale: 7.5,
                                condition_scale: 0.5,
                                lora_scale: 0.8,
                                num_outputs: 1,
                                apply_watermark: false,
                                negative_prompt: ""
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

            // Crop rightmost 512px for next iteration seed
            const seedPath = path.join(outputDir, `${date}_seed_${i + 1}.png`);
            await sharp(buffer)
                .extract({
                    width: 512,
                    height: 512,
                    left: Math.max(0, resultMeta.width - 512),
                    top: 0
                })
                .toFile(seedPath);

            currentImagePath = seedPath;
            console.log(`Next seed prepared: ${seedPath} (512x512)`);

        } catch (error) {
            console.error(`Error generating segment ${i + 1}:`, error);
            throw new Error(`Failed to generate segment ${i + 1}: ${error.message}`);
        }
    }

    // Stitch all segments together horizontally
    console.log('\nStitching segments together...');
    const fullDayPath = await stitchImages(segmentPaths, outputDir, date, EXTENSION_WIDTH);

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
