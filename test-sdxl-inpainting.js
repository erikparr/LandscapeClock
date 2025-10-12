/**
 * Test script for SDXL inpainting-based image generation
 */

import 'dotenv/config';
import { generateDailyLandscape } from './server/services/sdxlInpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedImagePath = path.join(__dirname, 'static/images/input.jpg');
const outputDir = path.join(__dirname, 'static/images/2025-10-10-sdxl-inpainting');
const date = '2025-10-10';

// Generate 24 prompts for a full day (one per hour)
const prompts = [
    "Mountain landscape at dawn (6 AM) with soft pink sky and morning mist rising from turquoise lake",
    "Early morning mountain scene (7 AM) with golden sunlight touching snow-capped peaks and pine forests",
    "Morning alpine landscape (8 AM) with bright sun illuminating evergreen trees and crystal clear lake",
    "Mid-morning mountain vista (9 AM) with vibrant blue sky and lush green meadows extending eastward",
    "Late morning alpine terrain (10 AM) with wildflowers blooming across mountain slopes and valleys",
    "Midday mountain panorama (11 AM) with intense sunlight on rocky peaks and scattered clouds above",
    "Noon mountain landscape (12 PM) with brilliant blue sky and dramatic shadows on mountain faces",
    "Early afternoon alpine scene (1 PM) with warm light on forest canopy and distant mountain ranges",
    "Afternoon mountain vista (2 PM) with soft clouds drifting past towering peaks and green valleys",
    "Mid-afternoon landscape (3 PM) with golden light filtering through pine trees and rocky outcrops",
    "Late afternoon mountain view (4 PM) with lengthening shadows across alpine meadows and ridges",
    "Evening approach (5 PM) with amber light painting mountain peaks and deepening valley shadows",
    "Early evening landscape (6 PM) with warm sunset colors beginning to illuminate western peaks",
    "Sunset mountain scene (7 PM) with orange and pink sky reflecting in tranquil alpine lake",
    "Dusk alpine landscape (8 PM) with fading light on mountain silhouettes and first stars appearing",
    "Twilight mountain vista (9 PM) with deep blue sky and last traces of sunset on distant peaks",
    "Early night landscape (10 PM) with moonlight casting silver glow on snow-capped mountains",
    "Night mountain scene (11 PM) with starry sky above dark silhouettes of pine forests and peaks",
    "Midnight alpine landscape (12 AM) with brilliant stars and moon illuminating mountain ridges",
    "Late night mountain vista (1 AM) with deep darkness broken by moonlight on lake surface",
    "Pre-dawn landscape (2 AM) with stars fading and first hint of light on eastern horizon",
    "Early morning darkness (3 AM) with moon setting and mountain peaks barely visible against sky",
    "Dawn approach (4 AM) with subtle lightening of sky and mountain silhouettes becoming clearer",
    "First light (5 AM) with soft blue hour glow emerging and revealing mountain contours again"
];

console.log('Starting SDXL inpainting test...');
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
