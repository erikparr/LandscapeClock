/**
 * Full 24-hour landscape generation test using LangChain-generated prompts
 * with multi-day continuity support
 */

import 'dotenv/config';
import { generateDailyPrompts, savePromptsToFile } from './server/services/promptGenerator.js';
import { generateDailyLandscape } from './server/services/stabilitySDInpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const date = new Date().toISOString().split('T')[0]; // Today's date YYYY-MM-DD
const outputDir = path.join(__dirname, `static/images/${date}-full-day`);
const promptsFile = path.join(outputDir, `${date}_prompts.txt`);

// Default fallback values
const defaultSeedPath = path.join(__dirname, 'static/images/input.jpg');
const defaultDescription = "a natural landscape with mountains, turquoise lake and pine forests at dawn";

console.log('═══════════════════════════════════════════════════════');
console.log('  24-Hour Landscape Generation with Multi-Day Continuity');
console.log('═══════════════════════════════════════════════════════');
console.log(`Date: ${date}\n`);

async function loadPreviousDayOutputs() {
    // Calculate yesterday's date
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    const prevSeedPath = path.join(__dirname, `static/images/${yesterdayDate}-full-day/${yesterdayDate}_final_seed.png`);
    const prevDescPath = path.join(__dirname, `static/images/${yesterdayDate}-full-day/${yesterdayDate}_final_description.txt`);

    console.log('Checking for previous day outputs...');
    console.log(`  Previous seed: ${prevSeedPath}`);
    console.log(`  Previous description: ${prevDescPath}\n`);

    if (await fs.pathExists(prevSeedPath) && await fs.pathExists(prevDescPath)) {
        const previousDescription = await fs.readFile(prevDescPath, 'utf-8');
        console.log('🔗 CONTINUITY MODE: Using previous day outputs');
        console.log(`  Yesterday: ${yesterdayDate}`);
        console.log(`  Final description: "${previousDescription.trim()}"\n`);

        return {
            seedImagePath: prevSeedPath,
            initialDescription: previousDescription.trim()
        };
    } else {
        console.log('🆕 FRESH START: No previous day outputs found');
        console.log('   Using default seed and description\n');

        return {
            seedImagePath: defaultSeedPath,
            initialDescription: defaultDescription
        };
    }
}

async function main() {
    try {
        // Load previous day outputs for continuity (or use defaults)
        const { seedImagePath, initialDescription } = await loadPreviousDayOutputs();

        console.log('═══════════════════════════════════════════════════════');
        console.log('STEP 1: Generating 24 chained prompts with LangChain...\n');
        console.log(`Seed image: ${seedImagePath}`);
        console.log(`Initial description: "${initialDescription}"\n`);

        // Generate 24 chained prompts using LangChain with continuity
        const prompts = await generateDailyPrompts(initialDescription, new Date(date));

        // Create output directory and save prompts
        await fs.ensureDir(outputDir);
        await savePromptsToFile(prompts, promptsFile);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('STEP 2: Generating 24-segment panorama...\n');

        // Generate the full 24-hour panorama using the prompts
        const result = await generateDailyLandscape(seedImagePath, prompts, outputDir, date);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Prompts saved: ${promptsFile}`);
        console.log(`Final panorama: ${result.fullDayPath}`);
        console.log(`Final seed (for tomorrow): ${result.finalSeedPath}`);
        console.log(`Final description (for tomorrow): "${result.finalDescription}"`);
        console.log(`Total segments: 24 (6 AM - 5 AM)`);
        console.log(`Final dimensions: ~6656x512 pixels`);
        console.log('\n🔗 Next day will seamlessly continue from this landscape!');

    } catch (error) {
        console.error('\n❌ Generation failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
