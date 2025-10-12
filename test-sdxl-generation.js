/**
 * Test script for SDXL outpainting image generation
 */

import 'dotenv/config';
import { generateDailyLandscape } from './server/services/sdxlImageGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedImagePath = path.join(__dirname, 'static/images/input.jpg');
const outputDir = path.join(__dirname, 'static/images/2025-10-10-sdxl');
const date = '2025-10-10';

// Generate 24 prompts for a full day (one per hour)
const prompts = [
    " mountain landscape at dawn (6 AM) with soft pink sky and morning mist rising from turquoise lake, matching existing style and lighting",
    " early morning mountain scene (7 AM) with golden sunlight touching snow-capped peaks and pine forests, matching existing composition",
    " morning alpine landscape (8 AM) with bright sun illuminating evergreen trees and crystal clear lake, continuing naturally from left",
    " mid-morning mountain vista (9 AM) with vibrant blue sky and lush green meadows extending eastward, maintaining visual continuity",
    " late morning alpine terrain (10 AM) with wildflowers blooming across mountain slopes and valleys, matching existing landscape",
    " midday mountain panorama (11 AM) with intense sunlight on rocky peaks and scattered clouds above, natural continuation",
    " noon mountain landscape (12 PM) with brilliant blue sky and dramatic shadows on mountain faces, blending smoothly",
    " early afternoon alpine scene (1 PM) with warm light on forest canopy and distant mountain ranges, matching atmosphere",
    " afternoon mountain vista (2 PM) with soft clouds drifting past towering peaks and green valleys, natural flow",
    " mid-afternoon landscape (3 PM) with golden light filtering through pine trees and rocky outcrops, continuous composition",
    " late afternoon mountain view (4 PM) with lengthening shadows across alpine meadows and ridges, matching lighting",
    " evening approach (5 PM) with amber light painting mountain peaks and deepening valley shadows, natural transition",
    " early evening landscape (6 PM) with warm sunset colors beginning to illuminate western peaks, matching warm tones",
    " sunset mountain scene (7 PM) with orange and pink sky reflecting in tranquil alpine lake, blending colors naturally",
    " dusk alpine landscape (8 PM) with fading light on mountain silhouettes and first stars appearing, matching atmosphere",
    " twilight mountain vista (9 PM) with deep blue sky and last traces of sunset on distant peaks, natural continuation",
    " early night landscape (10 PM) with moonlight casting silver glow on snow-capped mountains, matching moonlit mood",
    " night mountain scene (11 PM) with starry sky above dark silhouettes of pine forests and peaks, continuous darkness",
    " midnight alpine landscape (12 AM) with brilliant stars and moon illuminating mountain ridges, matching night lighting",
    " late night mountain vista (1 AM) with deep darkness broken by moonlight on lake surface, natural flow",
    " pre-dawn landscape (2 AM) with stars fading and first hint of light on eastern horizon, matching pre-dawn atmosphere",
    " early morning darkness (3 AM) with moon setting and mountain peaks barely visible against sky, blending naturally",
    " dawn approach (4 AM) with subtle lightening of sky and mountain silhouettes becoming clearer, matching dawn transition",
    " first light (5 AM) with soft blue hour glow emerging and revealing mountain contours again, continuous blue hour"
];

console.log('Starting SDXL outpainting test...');
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
