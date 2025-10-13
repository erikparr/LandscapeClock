/**
 * Automated next-day landscape generation with multi-day continuity
 *
 * This script is designed to be called by the scheduler (5 PM daily) or manually
 * to generate tomorrow's landscape panorama with seamless continuity from today.
 *
 * Usage:
 *   node generate-next-day.js                    # Generate tomorrow's landscape
 *   node generate-next-day.js --date=2025-10-15  # Generate specific date
 */

import 'dotenv/config';
import { generateDailyPrompts, savePromptsToFile } from './server/services/promptGenerator.js';
import { generateDailyLandscape } from './server/services/stabilitySDInpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const dateArg = args.find(arg => arg.startsWith('--date='));

// Determine target date (tomorrow by default, or specified date)
let targetDate;
if (dateArg) {
    const dateStr = dateArg.split('=')[1];
    targetDate = dateStr;
} else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow.toISOString().split('T')[0];
}

const outputDir = path.join(__dirname, `static/images/${targetDate}-full-day`);
const promptsFile = path.join(outputDir, `${targetDate}_prompts.txt`);

// Default fallback values
const defaultSeedPath = path.join(__dirname, 'static/images/input.jpg');
const defaultDescription = "a natural landscape with mountains, turquoise lake and pine forests at dawn";

console.log('═══════════════════════════════════════════════════════');
console.log('  Automated Next-Day Landscape Generation');
console.log('═══════════════════════════════════════════════════════');
console.log(`Target date: ${targetDate}`);
console.log(`Current time: ${new Date().toISOString()}\n`);

/**
 * Load previous day's outputs for continuity
 */
async function loadPreviousDayOutputs(targetDate) {
    // Calculate previous day's date
    const previousDay = new Date(targetDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDate = previousDay.toISOString().split('T')[0];

    const prevSeedPath = path.join(__dirname, `static/images/${previousDate}-full-day/${previousDate}_final_seed.png`);
    const prevDescPath = path.join(__dirname, `static/images/${previousDate}-full-day/${previousDate}_final_description.txt`);

    console.log('Checking for previous day outputs...');
    console.log(`  Previous day: ${previousDate}`);
    console.log(`  Seed path: ${prevSeedPath}`);
    console.log(`  Description path: ${prevDescPath}\n`);

    if (await fs.pathExists(prevSeedPath) && await fs.pathExists(prevDescPath)) {
        const previousDescription = await fs.readFile(prevDescPath, 'utf-8');
        console.log('✅ CONTINUITY MODE: Previous day outputs found');
        console.log(`   Final description: "${previousDescription.trim().substring(0, 80)}..."\n`);

        return {
            seedImagePath: prevSeedPath,
            initialDescription: previousDescription.trim(),
            hasContinuity: true
        };
    } else {
        console.log('⚠️  FRESH START: No previous day outputs found');
        console.log('   Using default seed and description\n');

        return {
            seedImagePath: defaultSeedPath,
            initialDescription: defaultDescription,
            hasContinuity: false
        };
    }
}

/**
 * Check if target date already has a generated panorama
 */
async function checkExistingPanorama(targetDate) {
    const existingPanorama = path.join(__dirname, `static/images/${targetDate}-full-day/${targetDate}_full_day_landscape.png`);
    if (await fs.pathExists(existingPanorama)) {
        console.log(`⚠️  Panorama already exists for ${targetDate}`);
        console.log(`   Path: ${existingPanorama}`);
        console.log('\n   Skipping generation. Delete the existing file to regenerate.\n');
        return true;
    }
    return false;
}

/**
 * Copy generated files to web-accessible location
 */
async function copyToWebDirectory(targetDate, result) {
    const webDir = path.join(__dirname, `static/images/${targetDate}`);
    await fs.ensureDir(webDir);

    // Copy panorama
    const webPanoramaPath = path.join(webDir, `${targetDate}_full_day_landscape.png`);
    await fs.copy(result.fullDayPath, webPanoramaPath);
    console.log(`   Copied panorama to: ${webPanoramaPath}`);

    // Copy prompts as descriptions
    const webDescPath = path.join(webDir, `${targetDate}_generated_descriptions.txt`);
    const promptsSourcePath = path.join(outputDir, `${targetDate}_prompts.txt`);
    if (await fs.pathExists(promptsSourcePath)) {
        await fs.copy(promptsSourcePath, webDescPath);
        console.log(`   Copied descriptions to: ${webDescPath}`);
    }

    return webPanoramaPath;
}

/**
 * Main generation function
 */
async function main() {
    try {
        // Check if panorama already exists
        if (await checkExistingPanorama(targetDate)) {
            process.exit(0);
        }

        // Load previous day outputs for continuity (or use defaults)
        const { seedImagePath, initialDescription, hasContinuity } = await loadPreviousDayOutputs(targetDate);

        console.log('═══════════════════════════════════════════════════════');
        console.log('STEP 1: Generating 24 chained prompts...\n');
        console.log(`Seed image: ${path.basename(seedImagePath)}`);
        console.log(`Continuity: ${hasContinuity ? '✅ Yes' : '❌ No (fresh start)'}`);
        console.log(`Initial description: "${initialDescription.substring(0, 60)}..."\n`);

        // Generate 24 chained prompts using LangChain with continuity
        const prompts = await generateDailyPrompts(initialDescription, new Date(targetDate));

        // Create output directory and save prompts
        await fs.ensureDir(outputDir);
        await savePromptsToFile(prompts, promptsFile);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('STEP 2: Generating 24-segment panorama...\n');

        // Generate the full 24-hour panorama
        const result = await generateDailyLandscape(seedImagePath, prompts, outputDir, targetDate);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('STEP 3: Copying to web-accessible directory...\n');

        const webPanoramaPath = await copyToWebDirectory(targetDate, result);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ GENERATION COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Date: ${targetDate}`);
        console.log(`Continuity: ${hasContinuity ? 'Seamlessly continues from previous day' : 'Fresh start'}`);
        console.log(`Prompts: ${promptsFile}`);
        console.log(`Panorama: ${result.fullDayPath}`);
        console.log(`Web path: ${webPanoramaPath}`);
        console.log(`Final seed: ${result.finalSeedPath}`);
        console.log(`Final description: "${result.finalDescription.substring(0, 60)}..."`);
        console.log(`\n🔗 Next day will seamlessly continue from this landscape!`);

    } catch (error) {
        console.error('\n❌ Generation failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
