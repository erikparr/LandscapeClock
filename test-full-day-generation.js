/**
 * Full 24-hour landscape generation test using LangChain-generated prompts
 */

import 'dotenv/config';
import { generateDailyPrompts, savePromptsToFile } from './server/services/promptGenerator.js';
import { generateDailyLandscape } from './server/services/stabilitySDInpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedImagePath = path.join(__dirname, 'static/images/input.jpg');
const date = new Date().toISOString().split('T')[0]; // Today's date YYYY-MM-DD
const outputDir = path.join(__dirname, `static/images/${date}-full-day`);
const promptsFile = path.join(outputDir, `${date}_prompts.txt`);

console.log('═══════════════════════════════════════════════════════');
console.log('  24-Hour Landscape Generation with LangChain Prompts');
console.log('═══════════════════════════════════════════════════════');
console.log(`Seed image: ${seedImagePath}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Date: ${date}\n`);

async function main() {
    try {
        // Step 1: Generate 24 chained prompts using LangChain
        console.log('STEP 1: Generating 24 prompts with LangChain...\n');
        const prompts = await generateDailyPrompts();

        // Create output directory and save prompts
        const fs = await import('fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
        await savePromptsToFile(prompts, promptsFile);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('STEP 2: Generating 24-segment panorama...\n');

        // Step 2: Generate the full 24-hour panorama using the prompts
        const fullDayPath = await generateDailyLandscape(seedImagePath, prompts, outputDir, date);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Prompts saved: ${promptsFile}`);
        console.log(`Final panorama: ${fullDayPath}`);
        console.log(`Total segments: 24 (6 AM - 5 AM)`);
        console.log(`Final dimensions: ~6656x512 pixels`);

    } catch (error) {
        console.error('\n❌ Generation failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
