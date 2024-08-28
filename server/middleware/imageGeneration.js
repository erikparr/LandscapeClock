/**
 * imageGeneration.js
 * 
 * This Nuxt.js server middleware handles the generation and serving
 * of landscape images for the Exquisite Landscape Clock application.
 * 
 * Key functionalities:
 * 1. Scheduled daily generation of a full-day landscape image
 * 2. Retrieval of the last generated image for continuity
 * 3. Maintaining a rolling 7-day window of full-day images
 * 4. Serving the current full-day image through an API endpoint
 * 5. Execution of Python script for image generation
 * 6. Handling both normal and simulation modes
 */

import { scheduleJob } from 'node-schedule';
import fs from 'fs-extra';
import { DateTime } from 'luxon';
import { PythonShell } from 'python-shell';
import path from 'path';
import { glob } from 'glob';
import { eventHandler, setHeader, sendStream, createError } from 'h3';
import sharp from 'sharp';

// Define constants for file paths and names
const IMAGE_BASE_PATH = path.join(process.cwd(), 'static', 'images');
const FULL_DAY_IMAGE_NAME = 'full_day_landscape.png';
const DEFAULT_IMAGE = '/images/default_seed_image.png';

let isGeneratingImage = false;


/**
 * Retrieves the path of the last generated image.
 * This is used as a starting point for generating the next day's image.
 * @returns {Promise<string>} Path to the last generated image or default image
 */
async function getLastGeneratedImagePath() {
    const yesterday = DateTime.now().minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const pattern = path.join(IMAGE_BASE_PATH, `${yesterday}_segment_23.png`);
    if (await fs.pathExists(pattern)) {
        return pattern;
    } else {
        return path.join(IMAGE_BASE_PATH, "default_seed_image.png");
    }
}

/**
 * Generates prompts for each hour of the day.
 * TODO: Implement more sophisticated prompt generation
 * @returns {Promise<string[]>} Array of 24 prompts, one for each hour
 */
async function generatePromptsForDay() {
    return Array(24).fill().map((_, i) => `Landscape at ${i}:00`);
}

/**
 * Cleans up old images, maintaining only the last 7 days of full-day images.
 */
async function cleanupOldImages() {
    const files = await fs.readdir(IMAGE_BASE_PATH);
    const fullDayImages = files.filter(file => file.endsWith(FULL_DAY_IMAGE_NAME));
    
    if (fullDayImages.length > 7) {
        const sortedImages = fullDayImages.sort().reverse();
        for (const file of sortedImages.slice(7)) {
            const datePrefix = file.split('_')[0];
            await fs.remove(path.join(IMAGE_BASE_PATH, datePrefix));
        }
    }
}

/**
 * Generates and manages images for a specific date.
 * @param {string} date - The date for which to generate images (format: 'yyyy-MM-dd')
 * @returns {Promise<string>} Path to the generated full-day image
 */
async function generateAndManageImages(date, seedImagePath) {
    const outputDir = path.join(IMAGE_BASE_PATH, date);
    await fs.ensureDir(outputDir);

    const prompts = await generatePromptsForDay();

    try {
        console.log(`Starting image sequence generation for ${date} using seed image: ${seedImagePath}`);
        const newSequencePaths = await runPythonScript(seedImagePath, prompts, outputDir, date);
        
        if (!newSequencePaths || newSequencePaths.length === 0) {
            throw new Error('No new images were generated');
        }

        // The last image in the sequence is the full day landscape
        const fullDayImagePath = newSequencePaths[newSequencePaths.length - 1];
        
        // Rename the full day image
        const newFullDayImagePath = path.join(outputDir, `${date}_${FULL_DAY_IMAGE_NAME}`);
        await fs.move(fullDayImagePath, newFullDayImagePath, { overwrite: true });

        console.log(`Full day image generated and saved: ${newFullDayImagePath}`);

        // Clean up segment files
        console.log('Cleaning up segment files...');
        for (const segmentPath of newSequencePaths.slice(0, -1)) {
            await fs.remove(segmentPath);
            console.log(`Removed segment file: ${segmentPath}`);
        }

        // Maintain only the last 7 days of images
        await cleanupOldImages();

        return newFullDayImagePath;
    } catch (error) {
        console.error('Error in image generation process:', error);
        throw error;
    }
}

/**
 * Runs the Python script to generate the image sequence.
 * @param {string} seedImagePath - Path to the seed image
 * @param {string[]} prompts - Array of prompts for each hour
 * @param {string} outputDir - Directory to save the generated images
 * @param {string} date - Date for which images are being generated
 * @returns {Promise<string[]>} Paths to the generated images
 */
async function runPythonScript(seedImagePath, prompts, outputDir, date) {
    return new Promise((resolve, reject) => {
        PythonShell.run('services/image_extender.py', {
            args: [seedImagePath, JSON.stringify(prompts), outputDir, date],
            pythonPath: 'python3', // Adjust this to your Python interpreter path
        }, function (err, results) {
            if (err) {
                console.error('Error running Python script:', err);
                reject(err);
            } else {
                try {
                    const { full_day_path } = JSON.parse(results[results.length - 1]);
                    resolve([full_day_path]); // Wrap in array to match expected format
                } catch (parseError) {
                    console.error('Error parsing Python script output:', parseError);
                    reject(parseError);
                }
            }
        });
    });
}

async function checkAndGenerateImages(date) {
    console.log(`Checking and generating images for date: ${date}`);
    const imagePath = path.join(IMAGE_BASE_PATH, date, `${date}_full_day_landscape.png`);
    const seedImagePath = path.join(IMAGE_BASE_PATH, date, 'seed_image.png');
    
    if (!(await fs.pathExists(imagePath))) {
        console.log(`Full day image not found for ${date}. Generating...`);
        if (!(await fs.pathExists(seedImagePath))) {
            console.log(`Seed image not found for ${date}. Creating...`);
            await createSeedImageForDate(date);
        } else {
            console.log(`Using existing seed image for ${date}`);
        }
        if (!isGeneratingImage) {
            await generateImagesForDay(date);
        }
    } else {
        console.log(`Full day image already exists for ${date}`);
        // Optionally, you can still update the seed image for the next day
        const nextDate = DateTime.fromISO(date).plus({ days: 1 }).toFormat('yyyy-MM-dd');
        await createSeedImageForDate(nextDate);
    }
}

async function generateImagesForDay(date) {
    if (isGeneratingImage) return;

    isGeneratingImage = true;
    console.log(`Starting image generation for ${date}`);
    try {
        const dateFolder = path.join(IMAGE_BASE_PATH, date);
        const seedImagePath = path.join(dateFolder, 'seed_image.png');
        
        if (!(await fs.pathExists(seedImagePath))) {
            console.log(`Seed image not found for ${date}. Creating...`);
            await createSeedImageForDate(date);
        } else {
            console.log(`Using existing seed image for ${date}: ${seedImagePath}`);
        }

        await generateAndManageImages(date, seedImagePath);
        console.log(`Image generation for ${date} completed successfully`);
    } catch (error) {
        console.error(`Error in image generation for ${date}:`, error);
    } finally {
        isGeneratingImage = false;
    }
}

async function createSeedImageFromPreviousDay(previousDayImage, seedImagePath) {
    console.log(`Creating seed image from previous day's image: ${previousDayImage}`);
    try {
        const image = sharp(previousDayImage);
        const metadata = await image.metadata();
        console.log(`Previous day image metadata: width=${metadata.width}, height=${metadata.height}`);
        
        if (metadata.width < 512 || metadata.height < 512) {
            console.warn(`Previous day image is smaller than 512x512. Using as is.`);
            await fs.copy(previousDayImage, seedImagePath);
        } else {
            console.log(`Cropping image to 512x512 from right side`);
            await image
                .extract({ width: 512, height: 512, left: metadata.width - 512, top: 0 })
                .toFile(seedImagePath);
            
            console.log(`Seed image created successfully: ${seedImagePath}`);
        }
    } catch (error) {
        console.error(`Error creating seed image: ${error.message}`);
        console.error(error.stack);
        throw error;
    }
}

async function cropPreviousDayLandscape(previousDayImage) {
    console.log(`Cropping previous day's landscape: ${previousDayImage}`);
    try {
        const image = sharp(previousDayImage);
        const metadata = await image.metadata();
        
        if (metadata.width <= 12288) {
            console.warn(`Previous day image is already 12288px or smaller. Skipping crop.`);
            return;
        }
        
        console.log(`Cropping image to 12288x512 from left side`);
        await image
            .extract({ width: 12288, height: 512, left: 0, top: 0 })
            .toFile(previousDayImage + '.tmp');
        
        // Replace the original file with the cropped version
        await fs.move(previousDayImage + '.tmp', previousDayImage, { overwrite: true });
        
        console.log(`Previous day landscape cropped successfully`);
    } catch (error) {
        console.error(`Error cropping previous day landscape: ${error.message}`);
        console.error(error.stack);
        throw error;
    }
}

async function createSeedImageForDate(date) {
    console.log(`Attempting to create seed image for date: ${date}`);
    const seedImagePath = path.join(IMAGE_BASE_PATH, date, 'seed_image.png');
    
    if (await fs.pathExists(seedImagePath)) {
        console.log(`Seed image already exists for ${date}. Skipping creation.`);
        return;
    }

    const previousDate = DateTime.fromISO(date).minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const previousDayImage = path.join(IMAGE_BASE_PATH, previousDate, `${previousDate}_full_day_landscape.png`);
    
    await fs.ensureDir(path.dirname(seedImagePath));

    if (await fs.pathExists(previousDayImage)) {
        console.log(`Using previous day's full landscape image: ${previousDayImage}`);
        await createSeedImageFromPreviousDay(previousDayImage, seedImagePath);
        await cropPreviousDayLandscape(previousDayImage);
    } else {
        console.log(`No previous day image found. Using default seed image for ${date}`);
        const defaultSeedImage = path.join(IMAGE_BASE_PATH, 'default_seed_image.png');
        if (await fs.pathExists(defaultSeedImage)) {
            await fs.copy(defaultSeedImage, seedImagePath);
        } else {
            console.warn(`Default seed image not found at ${defaultSeedImage}. Cannot create seed image for ${date}`);
        }
    }
}

export async function initializeImageGeneration() {
    const today = DateTime.now().toFormat('yyyy-MM-dd');
    const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');

    console.log('Initializing image generation...');
    console.log(`Checking and generating images for today (${today}) and tomorrow (${tomorrow}) if needed`);

    await checkAndGenerateImages(today);
    await checkAndGenerateImages(tomorrow);

    console.log('Image generation initialization complete');
}

// Schedule daily image generation for tomorrow at midnight
scheduleJob('0 0 * * *', async function() {
    if (!isGeneratingImage) {
        const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');
        await generateImagesForDay(tomorrow);
    }
});

export async function checkAndGenerateNextDayImages(date) {
    const nextDate = DateTime.fromISO(date).plus({ days: 1 }).toFormat('yyyy-MM-dd');
    await checkAndGenerateImages(nextDate);
}

/**
 * Main event handler for the middleware.
 * Handles API requests for current landscape and manual image generation.
 */
export default eventHandler(async (event) => {
    const url = new URL(event.node.req.url, `http://${event.node.req.headers.host}`);
    const simulationTime = url.searchParams.get('simulation_time');
    const now = simulationTime ? DateTime.fromISO(simulationTime) : DateTime.now();

    if (url.pathname === '/api/current-landscape') {
        const today = now.toFormat('yyyy-MM-dd');
        const tomorrow = now.plus({ days: 1 }).toFormat('yyyy-MM-dd');
        
        const todayImagePath = path.join(IMAGE_BASE_PATH, today, `${today}_full_day_landscape.png`);
        const tomorrowImagePath = path.join(IMAGE_BASE_PATH, tomorrow, `${tomorrow}_full_day_landscape.png`);
        
        try {
            let response = {
                currentTime: now.toISO(),
                todayImage: DEFAULT_IMAGE,
                tomorrowImage: null
            };

            if (await fs.pathExists(todayImagePath)) {
                response.todayImage = `/images/${today}/${today}_full_day_landscape.png`;
                console.log(`Today's image found: ${response.todayImage}`);
            } else {
                console.log(`Today's image not found: ${todayImagePath}. Using default image.`);
                if (simulationTime) {
                    const created = await createNextDayImages(now.minus({ days: 1 }).toFormat('yyyy-MM-dd'));
                    if (created) {
                        response.todayImage = `/images/${today}/${today}_full_day_landscape.png`;
                        console.log(`Created today's image for simulation: ${response.todayImage}`);
                    }
                }
            }

            if (await fs.pathExists(tomorrowImagePath)) {
                response.tomorrowImage = `/images/${tomorrow}/${tomorrow}_full_day_landscape.png`;
                console.log(`Tomorrow's image found: ${response.tomorrowImage}`);
            } else {
                console.log(`Tomorrow's image not found: ${tomorrowImagePath}`);
                if (simulationTime) {
                    const created = await createNextDayImages(today);
                    if (created) {
                        response.tomorrowImage = `/images/${tomorrow}/${tomorrow}_full_day_landscape.png`;
                        console.log(`Created tomorrow's image for simulation: ${response.tomorrowImage}`);
                    }
                }
            }

            console.log('API Response:', response);

            setHeader(event, 'Content-Type', 'application/json');
            return response;
        } catch (error) {
            console.error('Error in landscape image handling:', error);
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to handle landscape image request'
            });
        }
    }

    if (url.pathname === '/api/manual-trigger' && event.node.req.method === 'POST') {
        try {
            const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');
            const seedImagePath = path.join(IMAGE_BASE_PATH, tomorrow, 'seed_image.png');
            
            if (!(await fs.pathExists(seedImagePath))) {
                await createSeedImageForDate(tomorrow);
            }
            
            const newImagePath = await generateAndManageImages(tomorrow, seedImagePath);
            return { success: true, message: 'Image generation completed', path: newImagePath };
        } catch (error) {
            console.error('Error in manual image generation:', error);
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate images'
            });
        }
    }
});

/**
 * Finds the most recent full-day image.
 * @returns {Promise<string|null>} Path to the most recent full-day image, or null if not found
 */
async function findMostRecentImage() {
    const files = await fs.readdir(IMAGE_BASE_PATH);
    const fullDayImages = files.filter(file => file.endsWith(FULL_DAY_IMAGE_NAME));
    if (fullDayImages.length === 0) return null;
    
    fullDayImages.sort().reverse(); // Sort in descending order
    return path.join(IMAGE_BASE_PATH, fullDayImages[0]);
}