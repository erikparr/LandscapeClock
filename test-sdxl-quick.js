/**
 * Quick test script for SDXL outpainting (3 segments only)
 */

import 'dotenv/config';
import { generateDailyLandscape } from './server/services/sdxlImageGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedImagePath = path.join(__dirname, 'static/images/input.jpg');
const outputDir = path.join(__dirname, 'static/images/test-sdxl-quick');
const date = 'test-sdxl';

// Just 3 prompts for quick testing
const prompts = [
    "Mountain landscape at dawn with soft pink sky and morning mist rising from turquoise lake",
    "Early morning mountain scene with golden sunlight touching snow-capped peaks and pine forests",
    "Morning alpine landscape with bright sun illuminating evergreen trees and crystal clear lake"
];

console.log('Starting SDXL outpainting quick test (3 segments)...');
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
