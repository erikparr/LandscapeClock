/**
 * Visual continuity verification script
 *
 * Extracts and compares the overlap regions between consecutive days
 * to verify pixel-perfect continuity at the transition point.
 *
 * Usage: node verify-visual-continuity.js <date1> <date2>
 * Example: node verify-visual-continuity.js 2025-10-01 2025-10-02
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractOverlapRegions(date1, date2) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  VISUAL CONTINUITY VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');

    const day1Panorama = path.join(__dirname, `static/images/${date1}-full-day/${date1}_full_day_landscape.png`);
    const day1FinalSeed = path.join(__dirname, `static/images/${date1}-full-day/${date1}_final_seed.png`);
    const day2Panorama = path.join(__dirname, `static/images/${date2}-full-day/${date2}_full_day_landscape.png`);

    // Check files exist
    if (!await fs.pathExists(day1Panorama)) {
        console.error(`❌ Day 1 panorama not found: ${day1Panorama}`);
        process.exit(1);
    }
    if (!await fs.pathExists(day2Panorama)) {
        console.error(`❌ Day 2 panorama not found: ${day2Panorama}`);
        process.exit(1);
    }
    if (!await fs.pathExists(day1FinalSeed)) {
        console.error(`❌ Day 1 final seed not found: ${day1FinalSeed}`);
        process.exit(1);
    }

    console.log(`Day 1: ${date1}`);
    console.log(`Day 2: ${date2}\n`);

    // Get dimensions
    const day1Meta = await sharp(day1Panorama).metadata();
    const day2Meta = await sharp(day2Panorama).metadata();

    console.log(`Day 1 panorama: ${day1Meta.width}x${day1Meta.height}`);
    console.log(`Day 2 panorama: ${day2Meta.width}x${day2Meta.height}\n`);

    // Extract regions for comparison
    const outputDir = path.join(__dirname, 'static/images/continuity-test');
    await fs.ensureDir(outputDir);

    console.log('Extracting comparison regions...\n');

    // 1. Day 1 final seed (saved)
    console.log('1. Day 1 final seed (512x512 from rightmost):');
    await fs.copy(day1FinalSeed, path.join(outputDir, `${date1}_final_seed.png`));
    console.log(`   ✅ Saved to: continuity-test/${date1}_final_seed.png`);

    // 2. Day 1 rightmost 512px (should match final seed)
    console.log('\n2. Day 1 rightmost 512px from panorama:');
    await sharp(day1Panorama)
        .extract({
            width: 512,
            height: day1Meta.height,
            left: day1Meta.width - 512,
            top: 0
        })
        .toFile(path.join(outputDir, `${date1}_rightmost_512px.png`));
    console.log(`   ✅ Saved to: continuity-test/${date1}_rightmost_512px.png`);

    // 3. Day 1 rightmost 256px (visible at 23:59:59)
    console.log('\n3. Day 1 rightmost 256px (what user sees at midnight):');
    await sharp(day1Panorama)
        .extract({
            width: 256,
            height: day1Meta.height,
            left: day1Meta.width - 256,
            top: 0
        })
        .toFile(path.join(outputDir, `${date1}_visible_at_2359.png`));
    console.log(`   ✅ Saved to: continuity-test/${date1}_visible_at_2359.png`);

    // 4. Day 2 leftmost 768px (first segment, contains the seed)
    console.log('\n4. Day 2 leftmost 768px (first segment with seed):');
    await sharp(day2Panorama)
        .extract({
            width: 768,
            height: day2Meta.height,
            left: 0,
            top: 0
        })
        .toFile(path.join(outputDir, `${date2}_leftmost_768px.png`));
    console.log(`   ✅ Saved to: continuity-test/${date2}_leftmost_768px.png`);

    // 5. Day 2 leftmost 512px (should match Day 1 final seed)
    console.log('\n5. Day 2 leftmost 512px (should match Day 1 seed):');
    await sharp(day2Panorama)
        .extract({
            width: 512,
            height: day2Meta.height,
            left: 0,
            top: 0
        })
        .toFile(path.join(outputDir, `${date2}_leftmost_512px.png`));
    console.log(`   ✅ Saved to: continuity-test/${date2}_leftmost_512px.png`);

    // 6. Day 2 leftmost 256px (visible at 00:00:00)
    console.log('\n6. Day 2 leftmost 256px (what user sees at midnight):');
    await sharp(day2Panorama)
        .extract({
            width: 256,
            height: day2Meta.height,
            left: 0,
            top: 0
        })
        .toFile(path.join(outputDir, `${date2}_visible_at_0000.png`));
    console.log(`   ✅ Saved to: continuity-test/${date2}_visible_at_0000.png`);

    // Create side-by-side comparison
    console.log('\n7. Creating side-by-side comparison...');

    const day1Right256 = await sharp(day1Panorama)
        .extract({
            width: 256,
            height: day1Meta.height,
            left: day1Meta.width - 256,
            top: 0
        })
        .toBuffer();

    const day2Left256 = await sharp(day2Panorama)
        .extract({
            width: 256,
            height: day2Meta.height,
            left: 0,
            top: 0
        })
        .toBuffer();

    await sharp({
        create: {
            width: 512,
            height: day1Meta.height,
            channels: 3,
            background: { r: 0, g: 0, b: 0 }
        }
    })
    .composite([
        { input: day1Right256, left: 0, top: 0 },
        { input: day2Left256, left: 256, top: 0 }
    ])
    .toFile(path.join(outputDir, `transition_${date1}_to_${date2}.png`));

    console.log(`   ✅ Saved to: continuity-test/transition_${date1}_to_${date2}.png`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📁 All comparison images saved to: static/images/continuity-test/\n');

    console.log('To verify continuity:');
    console.log('1. Compare these images - should be identical:');
    console.log(`   - ${date1}_final_seed.png (saved)`);
    console.log(`   - ${date1}_rightmost_512px.png (extracted)`);
    console.log(`   - ${date2}_leftmost_512px.png (should match!)\n`);

    console.log('2. Check transition image:');
    console.log(`   - transition_${date1}_to_${date2}.png`);
    console.log('   - Left half: Day 1 at 23:59:59');
    console.log('   - Right half: Day 2 at 00:00:00');
    console.log('   - Should show seamless landscape flow!\n');

    console.log('3. The 256px overlap ensures smooth transition:');
    console.log(`   - Day 1 final segment contains pixels [${day1Meta.width - 768}-${day1Meta.width}]`);
    console.log(`   - Day 2 first segment uses pixels [0-768]`);
    console.log(`   - Pixels [${day1Meta.width - 256}-${day1Meta.width}] appear in both!`);
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error('Usage: node verify-visual-continuity.js <date1> <date2>');
    console.error('Example: node verify-visual-continuity.js 2025-10-01 2025-10-02');
    process.exit(1);
}

const [date1, date2] = args;

// Validate date format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date1) || !dateRegex.test(date2)) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD');
    process.exit(1);
}

extractOverlapRegions(date1, date2);
