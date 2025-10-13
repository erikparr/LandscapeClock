# Multi-Day Continuity Implementation

## Overview

The LandscapeClock now supports **infinite seamless continuity** across multiple days. Each day's panorama seamlessly extends from the previous day's final landscape, creating an endless evolving scene.

## How It Works

### 1. Continuity Chain

```
Day 1 (5 AM segment 23) → Day 2 (6 AM segment 0) → Day 3 (6 AM segment 0) → ∞
      ↓                         ↑                         ↑
   Final seed              Uses Day 1              Uses Day 2
   Final description       final outputs            final outputs
```

### 2. Key Files Saved Per Day

Each generation creates these continuity files:

- `{date}_final_seed.png` - Rightmost 512x512 pixels from panorama (becomes next day's seed)
- `{date}_final_description.txt` - Final prompt (5 AM description, becomes next day's starting prompt)
- `{date}_full_day_landscape.png` - Complete 6656x512 panorama
- `{date}_prompts.txt` - All 24 prompts for the day

### 3. Visual Continuity

**Pixel Overlap:**
```
Day N Panorama:     [........................5 AM (rightmost 256px)]
Day N Final Seed:                    [512px from right edge]
Day N+1 Panorama:              [6 AM (uses that 512px seed)]..............
```

**Result:** 256px visual overlap ensures smooth transition at midnight!

### 4. Narrative Continuity

**Day 1 Final Prompt (5 AM):**
> "Seamlessly extending... pre-dawn mist with soft lavender hues..."

**Day 2 Initial Prompt (6 AM):**
> "Seamlessly extending from pre-dawn mist with soft lavender hues... dawn light breaks over..."

## Updated Generation Scripts

### 1. Test Script: `test-full-day-generation.js`

**What's New:**
- ✅ Checks for previous day's `_final_seed.png` and `_final_description.txt`
- ✅ If found: uses them for continuity
- ✅ If not: falls back to default seed/description
- ✅ Saves final outputs for next day

**Usage:**
```bash
node test-full-day-generation.js
```

### 2. Production Script: `generate-next-day.js`

**Features:**
- 📅 Generates tomorrow's landscape (or specific date with `--date=`)
- 🔗 Automatic continuity from previous day
- 📂 Copies to web-accessible directory
- ⚠️ Prevents duplicate generation

**Usage:**
```bash
# Generate tomorrow's landscape
node generate-next-day.js

# Generate specific date
node generate-next-day.js --date=2025-10-15
```

### 3. Scheduler: `server/middleware/imageGeneration.js`

**What Changed:**
- 🕔 **New schedule: 5 PM daily** (was midnight)
- ✅ Checks for today's continuity data
- 🔗 Passes to generation pipeline
- ⏰ Completes by ~5:17 PM (7 hours before midnight transition)

## Modified Services

### `promptGenerator.js`

**New Signature:**
```javascript
generateDailyPrompts(
  initialDescription = "default...",
  targetDate = new Date()
)
```

**What Changed:**
- Accepts custom `initialDescription` (from previous day's final prompt)
- Accepts `targetDate` for accurate seasonal context

### `stabilitySDInpaintingGenerator.js`

**New Return Value:**
```javascript
{
  fullDayPath: "/path/to/panorama.png",
  finalSeedPath: "/path/to/final_seed.png",
  finalDescription: "Last prompt text"
}
```

**What Changed:**
- Extracts rightmost 512x512 as final seed
- Saves final description to text file
- Returns paths for next day's use

## Testing Multi-Day Continuity

### Test Sequence

**Day 1 - Initial Generation:**
```bash
node test-full-day-generation.js
```

Expected output:
```
🆕 FRESH START: No previous day outputs found
   Using default seed and description

✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!
Final seed (for tomorrow): .../2025-10-12_final_seed.png
Final description (for tomorrow): "Seamlessly extending..."

🔗 Next day will seamlessly continue from this landscape!
```

**Day 2 - First Continuity:**
```bash
# Wait 1 day (or manually change system date)
node test-full-day-generation.js
```

Expected output:
```
🔗 CONTINUITY MODE: Using previous day outputs
  Yesterday: 2025-10-12
  Final description: "Seamlessly extending..."

✅ FULL DAY GENERATION COMPLETED SUCCESSFULLY!
🔗 Next day will seamlessly continue from this landscape!
```

**Day 3+ - Infinite Loop:**
```bash
# Each day seamlessly continues
node test-full-day-generation.js
```

### Visual Verification

1. **Extract midnight frames:**
```bash
# Day N at 23:59:59 (rightmost view)
# Day N+1 at 00:00:00 (leftmost view)
# Compare: should show seamless landscape progression
```

2. **Check seed continuity:**
```bash
# Compare these images - should be identical regions:
static/images/2025-10-12-full-day/2025-10-12_final_seed.png
# vs rightmost 512px of:
static/images/2025-10-12-full-day/2025-10-12_full_day_landscape.png
```

3. **Read prompt chain:**
```bash
# Day 1 final prompt should match Day 2 initial prompt source
cat static/images/2025-10-12-full-day/2025-10-12_final_description.txt
# Should be referenced in Day 2's first prompt generation
```

## Frontend Behavior (Already Working!)

The frontend already handles day transitions correctly:

**At 5 PM:**
- Preloads tomorrow's image
- Tomorrow's image was generated with continuity at 5 PM

**At Midnight (00:00:00):**
- Switches from Day N → Day N+1
- Day N+1 leftmost pixels contain Day N final seed
- **256px overlap = smooth visual flow**

**Pan Calculation:**
- 00:00:00 → 0% pan → leftmost (6 AM, extends yesterday's 5 AM)
- 23:59:59 → 100% pan → rightmost (5 AM, feeds tomorrow's 6 AM)

## Scheduling

### Automatic Generation (Production)

The scheduler runs at **5 PM daily**:

```javascript
scheduleJob('0 17 * * *', async function() {
  // Generates tomorrow's landscape
  // Uses today's final outputs for continuity
});
```

**Timeline:**
- 5:00 PM: Generation starts
- 5:02 PM: Prompts generated (~2 min)
- 5:17 PM: Images generated (~15 min)
- 5:17 PM: Ready in web directory
- 11:59 PM: Frontend preloaded (already done at 5 PM)
- 12:00 AM: Seamless switch to new day

### Manual Generation

```bash
# Generate tomorrow (respects continuity)
node generate-next-day.js

# Generate specific future date
node generate-next-day.js --date=2025-12-25

# Won't regenerate if already exists (safety)
```

## File Structure

```
static/images/
├── 2025-10-12-full-day/          # Generation artifacts
│   ├── 2025-10-12_full_day_landscape.png
│   ├── 2025-10-12_final_seed.png        # → Day 13 input
│   ├── 2025-10-12_final_description.txt # → Day 13 input
│   ├── 2025-10-12_prompts.txt
│   └── 2025-10-12_segment_*.png (cleaned up)
│
├── 2025-10-12/                   # Web-accessible
│   ├── 2025-10-12_full_day_landscape.png
│   └── 2025-10-12_generated_descriptions.txt
│
├── 2025-10-13-full-day/          # Next day (uses 10-12 outputs)
│   ├── 2025-10-13_full_day_landscape.png
│   ├── 2025-10-13_final_seed.png        # → Day 14 input
│   └── ...
│
└── input.jpg                     # Default seed (fallback only)
```

## Infinite Continuity Loop

```
Day 1 (Fresh start)
  ↓ generates final outputs
Day 2 (Uses Day 1 outputs)
  ↓ generates final outputs
Day 3 (Uses Day 2 outputs)
  ↓ generates final outputs
Day 4 (Uses Day 3 outputs)
  ↓
  ⋮
Day ∞ (Infinite seamless landscape)
```

**Seasonal Drift Prevention:**
- Each day includes current date in prompts
- AI naturally adjusts to seasonal changes
- E.g., Oct → Nov → Dec gradually adds winter elements

## Benefits

✅ **Seamless Visual Flow**: 256px overlap prevents jarring transitions
✅ **Narrative Continuity**: Each day extends previous day's story
✅ **Seasonal Awareness**: Naturally evolves with real-world seasons
✅ **No Quality Degradation**: Mask-based inpainting prevents feedback loops
✅ **Storage Efficient**: Only keeps 7 days rolling archive + continuity files
✅ **Frontend Compatible**: Existing UI already handles transitions perfectly

## Troubleshooting

### Issue: "No continuity data found"

**Cause:** Previous day's final outputs missing

**Fix:**
```bash
# Ensure previous day generation completed successfully
ls static/images/YYYY-MM-DD-full-day/*_final_*
```

### Issue: Hard edge at midnight transition

**Cause:** Continuity chain broken (Day N+1 didn't use Day N outputs)

**Fix:**
```bash
# Check if final seed was used
# Day N+1 should reference Day N's final seed in logs
```

### Issue: Scheduler not running

**Cause:** Node server not running at 5 PM

**Fix:**
```bash
# Check scheduler logs
# Manually trigger: node generate-next-day.js
```

## Future Enhancements

1. **Multi-day narrative memory**: Track themes across weeks
2. **Weather integration**: Match real weather patterns
3. **Location-specific**: Generate landscapes for user's geographic location
4. **Backup continuity**: Cloud storage of final outputs for recovery
5. **Quality monitoring**: Alert if visual degradation detected

## Summary

The multi-day continuity system creates an **infinite, seamless, evolving landscape** that:
- Extends naturally from day to day
- Maintains visual and narrative coherence
- Adapts to seasonal changes
- Requires no manual intervention
- Provides pixel-perfect transitions at midnight

The landscape now truly never ends! 🌄🔁
