/**
 * Test script for Fermat SDXL outpainting
 */

import 'dotenv/config';
import { generateDailyLandscape } from './server/services/fermatOutpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedImagePath = path.join(__dirname, 'static/images/input.jpg');
const outputDir = path.join(__dirname, 'static/images/2025-10-11-fermat');
const date = '2025-10-11';

// Test with 5 prompts first
const prompts = [
    "Seamlessly extend mountain landscape at dawn (6 AM) with soft pink sky and morning mist rising from turquoise lake, matching existing style and lighting",
    "Seamlessly extend early morning mountain scene (7 AM) with golden sunlight touching snow-capped peaks and pine forests, matching existing composition",
    "Seamlessly extend morning alpine landscape (8 AM) with bright sun illuminating evergreen trees and crystal clear lake, continuing naturally from left",
    "Seamlessly extend mid-morning mountain vista (9 AM) with vibrant blue sky and lush green meadows extending eastward, maintaining visual continuity",
    "Seamlessly extend late morning alpine terrain (10 AM) with wildflowers blooming across mountain slopes and valleys, matching existing landscape"
];

console.log('Starting Fermat SDXL outpainting test...');
console.log(`Seed image: ${seedImagePath}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Number of segments: ${prompts.length}`);

try {
    const fullDayPath = await generateDailyLandscape(seedImagePath, prompts, outputDir, date);
    console.log('\n✅ Generation completed successfully!');
    console.log(`Full day landscape: ${fullDayPath}`);
} catch (error) {
    console.error('\n❌ Generation failed:', error);
    process.exit(1);
}
