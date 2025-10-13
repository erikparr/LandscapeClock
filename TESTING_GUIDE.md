# Multi-Day Continuity Testing Guide

## Overview

This guide walks you through testing the multi-day continuity system to verify that landscapes seamlessly extend from day to day.

## Test Scripts

### 1. `test-continuity.js` - Full Integration Test

**What it does:**
- Generates 3 consecutive days (Day 1, Day 2, Day 3)
- Verifies continuity files are created
- Checks that each day uses the previous day's outputs
- Performs automated validation checks

**Usage:**
```bash
node test-continuity.js
```

**Expected output:**
```
Day 1 (2025-10-01): ✅ Generated (fresh start)
Day 2 (2025-10-02): ✅ Continuity verified
Day 3 (2025-10-03): ✅ Continuity verified

🎉 SUCCESS! Multi-day continuity is working perfectly!
```

**Time:** ~40-50 minutes (3 full generations)

**Checks performed:**
- ✅ Day 2 reports continuity mode
- ✅ Day 1 final seed exists
- ✅ Day 1 final description exists
- ✅ Final seed is 512x512 pixels
- ✅ Final description saved correctly
- (Repeats for Day 2 → Day 3)

---

### 2. `verify-visual-continuity.js` - Visual Comparison

**What it does:**
- Extracts overlap regions from consecutive days
- Creates side-by-side comparison images
- Verifies pixel-perfect continuity

**Usage:**
```bash
# After running test-continuity.js
node verify-visual-continuity.js 2025-10-01 2025-10-02
```

**Expected output:**
```
✅ Extracted comparison images
📁 All saved to: static/images/continuity-test/
```

**Generated files:**
```
continuity-test/
├── 2025-10-01_final_seed.png          # Saved seed
├── 2025-10-01_rightmost_512px.png     # Should match seed
├── 2025-10-01_visible_at_2359.png     # What user sees at 23:59
├── 2025-10-02_leftmost_768px.png      # First segment
├── 2025-10-02_leftmost_512px.png      # Should match Day 1 seed!
├── 2025-10-02_visible_at_0000.png     # What user sees at 00:00
└── transition_2025-10-01_to_2025-10-02.png  # Side-by-side
```

**Manual verification:**
1. Compare `2025-10-01_final_seed.png` with `2025-10-02_leftmost_512px.png` → should be identical
2. Open `transition_2025-10-01_to_2025-10-02.png` → should show seamless landscape
3. Compare `*_visible_at_2359.png` with `*_visible_at_0000.png` → should flow naturally

---

### 3. `test-full-day-generation.js` - Production Test

**What it does:**
- Generates today's panorama
- Checks for yesterday's outputs automatically
- Uses continuity if available

**Usage:**
```bash
# First run (Day 1)
node test-full-day-generation.js

# Next day (Day 2)
node test-full-day-generation.js
```

**Expected output (Day 1):**
```
🆕 FRESH START: No previous day outputs found
   Using default seed and description

✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!
Final seed (for tomorrow): .../2025-10-12_final_seed.png

🔗 Next day will seamlessly continue from this landscape!
```

**Expected output (Day 2):**
```
🔗 CONTINUITY MODE: Using previous day outputs
  Yesterday: 2025-10-12
  Final description: "Seamlessly extending..."

✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!
🔗 Next day will seamlessly continue from this landscape!
```

---

## Quick Test (Without Full Generation)

If you want to test the logic without waiting 15 minutes for generation:

### Test 1: Check Continuity Loading

```bash
# Create fake continuity files
mkdir -p static/images/2025-10-01-full-day
echo "test description" > static/images/2025-10-01-full-day/2025-10-01_final_description.txt
cp static/images/input.jpg static/images/2025-10-01-full-day/2025-10-01_final_seed.png

# Run test for Day 2 (will look for Day 1 outputs)
# Modify test script to only run prompt generation, not image generation
```

### Test 2: Verify Prompt Chaining

```bash
node -e "
import { generateDailyPrompts } from './server/services/promptGenerator.js';

const desc1 = 'mountains at dawn';
const prompts = await generateDailyPrompts(desc1, new Date('2025-10-15'));

console.log('First prompt:', prompts[0]);
console.log('Should reference:', desc1);
"
```

---

## Step-by-Step Testing Procedure

### Phase 1: Automated Tests (~50 minutes)

1. **Run full integration test:**
```bash
node test-continuity.js
```

2. **Wait for completion** (~40-50 min)

3. **Check results:**
   - Look for "✅ SUCCESS!" message
   - Verify all checks passed
   - Note the generated dates

### Phase 2: Visual Verification (~5 minutes)

4. **Extract visual comparisons:**
```bash
# Use dates from test-continuity.js output
node verify-visual-continuity.js 2025-10-01 2025-10-02
```

5. **Open comparison images:**
```bash
open static/images/continuity-test/transition_2025-10-01_to_2025-10-02.png
```

6. **Verify seamless transition:**
   - Left side (Day 1 at 23:59) should flow naturally into
   - Right side (Day 2 at 00:00)
   - No harsh edges or discontinuities

### Phase 3: Description Chain Verification (~2 minutes)

7. **Read saved descriptions:**
```bash
# Day 1 final description
cat static/images/2025-10-01-full-day/2025-10-01_final_description.txt

# Day 2 prompts (first one should reference Day 1's final)
head -1 static/images/2025-10-02-full-day/2025-10-02_prompts.txt
```

8. **Verify narrative continuity:**
   - Day 2's first prompt should start with "Seamlessly extending from..."
   - Should reference elements from Day 1's final description

---

## Expected File Structure After Tests

```
static/images/
├── 2025-10-01-full-day/
│   ├── 2025-10-01_full_day_landscape.png      (6656x512)
│   ├── 2025-10-01_final_seed.png              (512x512) ← Day 2 input
│   ├── 2025-10-01_final_description.txt       ← Day 2 input
│   └── 2025-10-01_prompts.txt
│
├── 2025-10-02-full-day/
│   ├── 2025-10-02_full_day_landscape.png      (6656x512)
│   ├── 2025-10-02_final_seed.png              (512x512) ← Day 3 input
│   ├── 2025-10-02_final_description.txt       ← Day 3 input
│   └── 2025-10-02_prompts.txt
│
├── 2025-10-03-full-day/
│   ├── 2025-10-03_full_day_landscape.png
│   ├── 2025-10-03_final_seed.png
│   ├── 2025-10-03_final_description.txt
│   └── 2025-10-03_prompts.txt
│
└── continuity-test/                            (from visual verification)
    ├── 2025-10-01_final_seed.png
    ├── 2025-10-01_rightmost_512px.png
    ├── 2025-10-02_leftmost_512px.png
    └── transition_2025-10-01_to_2025-10-02.png
```

---

## Common Issues & Troubleshooting

### Issue: test-continuity.js says "Continuity broken"

**Possible causes:**
1. Final seed not saved correctly
2. Final description file empty
3. Wrong file paths

**Debug:**
```bash
# Check if continuity files exist
ls -lh static/images/*/YYYY-MM-DD_final_*

# Check file sizes
# Final seed should be ~300-800 KB
# Final description should be ~200-500 bytes

# Check file contents
cat static/images/2025-10-01-full-day/2025-10-01_final_description.txt
```

### Issue: Visual comparison shows hard edge

**Possible causes:**
1. Day 2 didn't use Day 1 seed (check logs)
2. Mask-based inpainting not working
3. Different aspect ratios

**Debug:**
```bash
# Compare dimensions
identify static/images/2025-10-01-full-day/2025-10-01_final_seed.png
identify static/images/2025-10-02-full-day/2025-10-02_full_day_landscape.png

# Check if seed was used
grep "Using previous day" test-continuity.log
```

### Issue: Description doesn't chain

**Possible causes:**
1. Previous description not loaded
2. LangChain not receiving initialDescription
3. API rate limiting

**Debug:**
```bash
# Check what was passed to prompt generator
# Look in logs for: "Initial description: ..."

# Verify first prompt references previous
head -3 static/images/2025-10-02-full-day/2025-10-02_prompts.txt
# Should contain text from Day 1's final description
```

---

## Success Criteria

✅ **Automated checks pass:**
- All continuity verification checks pass
- Final files created with correct dimensions
- Descriptions saved and loaded

✅ **Visual continuity:**
- Transition images show seamless flow
- No harsh edges at midnight boundary
- Landscape elements naturally extend

✅ **Narrative continuity:**
- Day 2 prompts reference Day 1 descriptions
- "Seamlessly extending" appears in chained prompts
- Story flows naturally across days

✅ **Production ready:**
- `generate-next-day.js` works for manual runs
- Scheduler can call generation pipeline
- Error handling gracefully falls back to defaults

---

## Quick Smoke Test (5 minutes)

If you just want to verify the logic works:

```bash
# 1. Generate Day 1
node test-full-day-generation.js
# Wait ~15 minutes

# 2. Verify continuity files created
ls static/images/$(date +%Y-%m-%d)-full-day/*final*
# Should see: *_final_seed.png and *_final_description.txt

# 3. Generate Day 2 (manually set date to tomorrow)
node generate-next-day.js --date=2025-10-15
# Should see: "🔗 CONTINUITY MODE" in output

# Done! If both steps succeed, continuity works.
```

---

## Performance Metrics

**Full test-continuity.js:**
- Prompt generation: ~2 min × 3 days = 6 min
- Image generation: ~15 min × 3 days = 45 min
- Total: ~51 minutes

**Visual verification:**
- Extraction: ~30 seconds
- Manual review: 2-3 minutes

**Total testing time:** ~55 minutes for complete verification

---

## Next Steps After Testing

Once tests pass:

1. **Production deployment:**
   - Scheduler will run at 5 PM daily
   - First day uses default seed
   - All subsequent days use continuity

2. **Monitoring:**
   - Check logs for "CONTINUITY MODE" messages
   - Verify final files created each day
   - Monitor for quality degradation

3. **Enjoy infinite landscapes!** 🌄🔁
