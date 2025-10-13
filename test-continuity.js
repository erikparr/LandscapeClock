/**
 * Test script to verify multi-day continuity without waiting for real days to pass
 *
 * This generates 3 consecutive "days" rapidly to test:
 * - Day 1: Fresh start with default seed
 * - Day 2: Should use Day 1's final outputs
 * - Day 3: Should use Day 2's final outputs
 *
 * Usage: node test-continuity.js
 */

import 'dotenv/config';
import { generateDailyPrompts, savePromptsToFile } from './server/services/promptGenerator.js';
import { generateDailyLandscape } from './server/services/stabilitySDInpaintingGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default fallback values
const defaultSeedPath = path.join(__dirname, 'static/images/input.jpg');
const defaultDescription = "a natural landscape with mountains, turquoise lake and pine forests at dawn";

/**
 * Generate a single day's panorama with continuity check
 */
async function generateDay(dateStr, previousDate = null) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  GENERATING: ${dateStr}`);
    console.log('═══════════════════════════════════════════════════════');

    const outputDir = path.join(__dirname, `static/images/${dateStr}-full-day`);
    const promptsFile = path.join(outputDir, `${dateStr}_prompts.txt`);

    let seedImagePath, initialDescription, hasContinuity;

    // Check for previous day's outputs
    if (previousDate) {
        const prevSeedPath = path.join(__dirname, `static/images/${previousDate}-full-day/${previousDate}_final_seed.png`);
        const prevDescPath = path.join(__dirname, `static/images/${previousDate}-full-day/${previousDate}_final_description.txt`);

        console.log('\nChecking for previous day outputs...');
        console.log(`  Previous date: ${previousDate}`);
        console.log(`  Seed: ${prevSeedPath}`);
        console.log(`  Description: ${prevDescPath}`);

        if (await fs.pathExists(prevSeedPath) && await fs.pathExists(prevDescPath)) {
            const prevDesc = await fs.readFile(prevDescPath, 'utf-8');
            seedImagePath = prevSeedPath;
            initialDescription = prevDesc.trim();
            hasContinuity = true;

            console.log('  ✅ FOUND - Using for continuity');
            console.log(`  Previous description: "${initialDescription.substring(0, 80)}..."\n`);
        } else {
            seedImagePath = defaultSeedPath;
            initialDescription = defaultDescription;
            hasContinuity = false;

            console.log('  ❌ NOT FOUND - Using defaults\n');
        }
    } else {
        seedImagePath = defaultSeedPath;
        initialDescription = defaultDescription;
        hasContinuity = false;
        console.log('\n🆕 First day - starting fresh\n');
    }

    // Generate prompts
    console.log('STEP 1: Generating 24 prompts...');
    console.log(`  Seed: ${path.basename(seedImagePath)}`);
    console.log(`  Continuity: ${hasContinuity ? '✅ Yes' : '❌ No'}`);
    console.log(`  Initial: "${initialDescription.substring(0, 60)}..."\n`);

    const prompts = await generateDailyPrompts(initialDescription, new Date(dateStr));

    await fs.ensureDir(outputDir);
    await savePromptsToFile(prompts, promptsFile);

    console.log('\nSTEP 2: Generating panorama...\n');

    // Generate panorama
    const result = await generateDailyLandscape(seedImagePath, prompts, outputDir, dateStr);

    // Verify outputs
    console.log('\n✅ Generation complete!');
    console.log(`  Panorama: ${result.fullDayPath}`);
    console.log(`  Final seed: ${result.finalSeedPath}`);
    console.log(`  Final desc: "${result.finalDescription.substring(0, 60)}..."`);

    return {
        date: dateStr,
        hasContinuity,
        result
    };
}

/**
 * Verify continuity between days
 */
async function verifyContinuity(day1Result, day2Result) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  VERIFYING CONTINUITY: ${day1Result.date} → ${day2Result.date}`);
    console.log('═══════════════════════════════════════════════════════\n');

    const checks = [];

    // Check 1: Day 2 should have continuity flag
    if (day2Result.hasContinuity) {
        console.log('✅ Check 1: Day 2 reports continuity mode');
        checks.push(true);
    } else {
        console.log('❌ Check 1: Day 2 should have continuity but reports fresh start');
        checks.push(false);
    }

    // Check 2: Day 1 final seed exists
    const day1FinalSeed = day1Result.result.finalSeedPath;
    if (await fs.pathExists(day1FinalSeed)) {
        console.log(`✅ Check 2: Day 1 final seed exists at ${path.basename(day1FinalSeed)}`);
        checks.push(true);
    } else {
        console.log('❌ Check 2: Day 1 final seed missing');
        checks.push(false);
    }

    // Check 3: Day 1 final description exists
    const day1FinalDescPath = path.join(
        path.dirname(day1Result.result.fullDayPath),
        `${day1Result.date}_final_description.txt`
    );
    if (await fs.pathExists(day1FinalDescPath)) {
        console.log(`✅ Check 3: Day 1 final description exists`);
        checks.push(true);
    } else {
        console.log('❌ Check 3: Day 1 final description missing');
        checks.push(false);
    }

    // Check 4: Compare pixel dimensions
    try {
        const day1FinalSeedMeta = await sharp(day1FinalSeed).metadata();
        console.log(`✅ Check 4: Day 1 final seed dimensions: ${day1FinalSeedMeta.width}x${day1FinalSeedMeta.height}`);

        if (day1FinalSeedMeta.width === 512 && day1FinalSeedMeta.height === 512) {
            console.log('  ✅ Correct size (512x512)');
            checks.push(true);
        } else {
            console.log('  ❌ Wrong size - should be 512x512');
            checks.push(false);
        }
    } catch (error) {
        console.log('❌ Check 4: Could not read final seed metadata');
        checks.push(false);
    }

    // Check 5: Verify Day 1 description was saved
    try {
        const savedDesc = await fs.readFile(day1FinalDescPath, 'utf-8');
        const expectedDesc = day1Result.result.finalDescription;

        if (savedDesc.trim() === expectedDesc.trim()) {
            console.log('✅ Check 5: Day 1 final description saved correctly');
            checks.push(true);
        } else {
            console.log('❌ Check 5: Day 1 final description mismatch');
            checks.push(false);
        }
    } catch (error) {
        console.log('❌ Check 5: Could not verify description');
        checks.push(false);
    }

    const passedChecks = checks.filter(c => c).length;
    const totalChecks = checks.length;

    console.log(`\n${'='.repeat(59)}`);
    if (passedChecks === totalChecks) {
        console.log(`✅ CONTINUITY VERIFIED: ${passedChecks}/${totalChecks} checks passed`);
    } else {
        console.log(`⚠️  CONTINUITY ISSUES: ${passedChecks}/${totalChecks} checks passed`);
    }
    console.log(`${'='.repeat(59)}\n`);

    return passedChecks === totalChecks;
}

/**
 * Main test function
 */
async function main() {
    console.log('════════��══════════════════════════════════════════════');
    console.log('  MULTI-DAY CONTINUITY TEST');
    console.log('  Testing 3 consecutive days');
    console.log('═══════════════════════════════════════════════════════');

    // Use test dates (not real dates to avoid conflicts)
    const today = new Date();
    const day1Date = new Date(today.getFullYear(), today.getMonth(), 1); // 1st of month
    const day2Date = new Date(day1Date);
    day2Date.setDate(day2Date.getDate() + 1);
    const day3Date = new Date(day2Date);
    day3Date.setDate(day3Date.getDate() + 1);

    const day1Str = day1Date.toISOString().split('T')[0];
    const day2Str = day2Date.toISOString().split('T')[0];
    const day3Str = day3Date.toISOString().split('T')[0];

    console.log(`\nTest dates:`);
    console.log(`  Day 1: ${day1Str} (fresh start)`);
    console.log(`  Day 2: ${day2Str} (should continue from Day 1)`);
    console.log(`  Day 3: ${day3Str} (should continue from Day 2)`);

    try {
        // Generate Day 1
        const day1Result = await generateDay(day1Str, null);

        // Verify Day 1 continuity files created
        await verifyContinuity(
            { date: day1Str, hasContinuity: false, result: day1Result.result },
            { date: day1Str, hasContinuity: false }
        );

        // Generate Day 2
        const day2Result = await generateDay(day2Str, day1Str);

        // Verify Day 1 → Day 2 continuity
        const day1To2Valid = await verifyContinuity(day1Result, day2Result);

        // Generate Day 3
        const day3Result = await generateDay(day3Str, day2Str);

        // Verify Day 2 → Day 3 continuity
        const day2To3Valid = await verifyContinuity(day2Result, day3Result);

        // Final summary
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  TEST SUMMARY');
        console.log('═══════════════════════════════════════════════════════\n');

        console.log(`Day 1 (${day1Str}): ✅ Generated (fresh start)`);
        console.log(`Day 2 (${day2Str}): ${day1To2Valid ? '✅' : '❌'} ${day1To2Valid ? 'Continuity verified' : 'Continuity broken'}`);
        console.log(`Day 3 (${day3Str}): ${day2To3Valid ? '✅' : '❌'} ${day2To3Valid ? 'Continuity verified' : 'Continuity broken'}`);

        if (day1To2Valid && day2To3Valid) {
            console.log('\n🎉 SUCCESS! Multi-day continuity is working perfectly!');
            console.log('   Each day seamlessly extends from the previous day.\n');
        } else {
            console.log('\n⚠️  Some continuity checks failed. Review logs above.\n');
        }

        console.log('Generated files:');
        console.log(`  ${day1Str}-full-day/`);
        console.log(`  ${day2Str}-full-day/`);
        console.log(`  ${day3Str}-full-day/`);

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
