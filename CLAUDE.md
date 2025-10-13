# LandscapeClock - AI-Generated 24-Hour Landscape Panorama

## Overview

LandscapeClock is an innovative web application that generates continuous, seamless landscape panoramas representing a full 24-hour cycle. The system uses AI to create poetic, time-aware landscape descriptions via LangChain, then renders them as a 6656x512 pixel panoramic image using Stability AI's inpainting model. The resulting panorama is displayed in a web interface that pans through the image as real time progresses, showing the appropriate hour's landscape segment.

**🌐 Production Site:** https://landscapeclock.vercel.app
**📖 Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
**🔗 Multi-Day Continuity:** [MULTI_DAY_CONTINUITY.md](MULTI_DAY_CONTINUITY.md)

## Production Architecture

The system runs on a distributed cloud architecture:

```
┌─────────────────────────────────────────────────────────────┐
│              Vercel Frontend (Production)                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  LandscapeViewer.vue                               │    │
│  │  - Fetches images from Vercel Blob via API        │    │
│  │  - Pans based on current time                      │    │
│  │  - Shows clock and hourly description              │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  /api/current-landscape                            │    │
│  │  - Lists blobs from Vercel Blob storage           │    │
│  │  - Returns today's and tomorrow's URLs             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓ reads from
┌─────────────────────────────────────────────────────────────┐
│                  Vercel Blob Storage                         │
│  - Stores generated panoramas (6656x512 PNG)               │
│  - Stores continuity files (seeds + descriptions)           │
│  - CDN delivery for fast global access                      │
│  - 100GB/month free tier                                    │
└─────────────────────────────────────────────────────────────┘
                              ↑ writes to
┌─────────────────────────────────────────────────────────────┐
│              Railway Worker (Background Service)             │
│                                                              │
│  1. Prompt Generation (LangChain + OpenAI)                  │
│     promptGenerator.js                                       │
│     ├─ Generates 24 chained prompts                         │
│     ├─ Each prompt builds on previous description           │
│     ├─ Includes time of day + current date/season           │
│     └─ Output: Array of 24 descriptive prompts              │
│                                                              │
│  2. Image Generation (Replicate + Stability AI)             │
│     stabilitySDInpaintingGenerator.js                        │
│     ├─ Creates 768x512 canvas (512px seed + 256px new)     │
│     ├─ Uses mask-based inpainting (preserve vs generate)    │
│     ├─ Generates 24 segments iteratively                    │
│     └─ Stitches into 6656x512 final panorama               │
│                                                              │
│  3. Test Scripts                                            │
│     test-full-day-generation.js                             │
│     └─ Orchestrates full generation pipeline                │
└─────────────────────────────────────────────────────────────┘
```

## Core Technologies

- **Frontend**: Nuxt.js 3, Vue 3, TypeScript
- **Backend**: h3, Node.js, Express-like middleware
- **AI Models**:
  - OpenAI GPT-3.5-turbo (via LangChain) for prompt generation
  - Stability AI SD Inpainting (via Replicate) for image generation
- **Image Processing**: Sharp for canvas manipulation and stitching
- **Scheduling**: node-schedule for daily generation

## Key Files

### Generation Pipeline

#### [`server/services/promptGenerator.js`](server/services/promptGenerator.js)
Generates 24 AI-powered landscape descriptions using LangChain.

**Key Features:**
- **Chained prompts**: Each prompt references the previous description
- **Temporal awareness**: Includes time of day (6 AM - 5 AM)
- **Seasonal context**: Incorporates current date for seasonal details
- **Artistic language**: Uses poetic descriptors (luminous, mist-laden, ethereal, etc.)

**Meta-Prompt Template:**
```javascript
`Generate a single sentence describing a distant natural landscape at {current_time}, {current_date} that could seamlessly extend the following landscape: {previous_description}.

The new description should:
- Be different but complementary to the previous landscape
- Reflect the time of day and lighting conditions
- Reflect the season and date (spring, summer, autumn, winter characteristics)
- Start with "Seamlessly extend" to ensure continuity
- Match the existing style and composition
- additional inspirational Light and environmental descriptors: luminous, diffused, hazy, radiant, overcast, mist-laden, sun-drenched, twilight, glimmering, veiled, iridescent, vaporous, dawn-lit, dusky, vivid, refracted, translucent, atmospheric haze, etc
Description:`
```

**Output Example:**
```
"Seamlessly extending from the natural landscape with mountains, turquoise lake, and pine forests at dawn, on October 12, 2025, the distant landscape at 6 AM revealed rolling hills blanketed in a soft, mist-laden glow, with the first hints of autumn colors beginning to emerge amidst the serene tranquility of the early morning light."
```

#### [`server/services/stabilitySDInpaintingGenerator.js`](server/services/stabilitySDInpaintingGenerator.js)
Generates seamless panoramic landscapes using mask-based inpainting.

**Algorithm:**
1. Start with 512x512 seed image
2. For each of 24 segments:
   - Create 768x512 canvas
   - Composite seed image on left (512px)
   - Leave right side blank (256px)
   - Create mask: black for preserve (512px), white for generate (256px)
   - Call Stability AI SD Inpainting API with canvas, mask, and prompt
   - Extract rightmost 512px of result as seed for next iteration
3. Stitch all segments together:
   - First segment: full 768px width
   - Subsequent segments: only new 256px portion
   - Final size: 768 + (23 × 256) = 6656 × 512 pixels

**Key Parameters:**
- `width`: 768, `height`: 512
- `num_inference_steps`: 35
- `guidance_scale`: 7.5
- `negative_prompt`: "blurry, distorted, low quality, artifacts, discontinuous"

**Why This Works:**
- **Mask-based approach**: Explicitly tells AI what to preserve vs generate
- **Overlapping context**: 512px overlap ensures smooth transitions
- **No scheduler conflicts**: Uses default scheduler (avoid DDIM which was too aggressive)
- **Prompt continuity**: "Seamlessly extend" instruction + chained descriptions

### Frontend

#### [`components/LandscapeViewer.vue`](components/LandscapeViewer.vue)
Main display component for the panoramic landscape.

**Features:**
- **Time-based panning**: Image translates horizontally based on current time
  ```javascript
  panPercentage = (currentTimeInSeconds / 86400) * 100
  ```
- **Real-time clock**: Displays current time with custom font
- **Hourly descriptions**: Shows landscape description for current hour
- **Dynamic background**: Background color shifts based on time of day
- **Image preloading**: Fetches tomorrow's image at 5 PM

**Pan Calculation:**
```javascript
const totalSeconds = hours * 3600 + minutes * 60 + seconds
const dayProgress = totalSeconds / 86400  // 0.0 to 1.0
panPercentage.value = dayProgress * 100
```

At midnight (0:00), shows leftmost portion of panorama (6 AM segment).
At noon (12:00), shows middle portion (6 PM segment).
By 11:59 PM, has panned through entire 24-hour cycle.

#### [`pages/index.vue`](pages/index.vue)
Root page that provides current time to LandscapeViewer.

### Backend API

#### [`server/middleware/imageGeneration.js`](server/middleware/imageGeneration.js)
Handles image serving and scheduled generation.

**Endpoints:**
- `GET /api/current-landscape`: Returns URLs for today's and tomorrow's panoramas
  ```json
  {
    "currentTime": "2025-10-12T16:31:38.231-07:00",
    "todayImage": "/images/2025-10-12/2025-10-12_full_day_landscape.png",
    "tomorrowImage": "/images/2025-10-13/2025-10-13_full_day_landscape.png"
  }
  ```

**Scheduled Tasks:**
- Runs at midnight (0:00) daily via node-schedule
- Generates tomorrow's panorama
- Maintains rolling 7-day image archive
- Creates seed images from previous day's rightmost 512px

### Test Scripts

#### [`test-full-day-generation.js`](test-full-day-generation.js)
Standalone test script for full generation pipeline.

**Workflow:**
1. Generate 24 prompts via LangChain (OpenAI API)
2. Save prompts to text file
3. Generate 24-segment panorama via Stability AI
4. Stitch segments into final image
5. Clean up intermediate files

**Output:**
- `{date}_full_day_landscape.png`: 6656x512 panorama
- `{date}_prompts.txt`: All 24 generated prompts
- `{date}_segment_XX.png`: Individual segments (cleaned up after stitching)

## Image Generation Details

### Mask-Based Inpainting Approach

The system uses **explicit masking** to control what parts of the image to preserve vs regenerate:

```
┌──────────────────────────────────────┐
│         768x512 Canvas               │
│  ┌─────────────┬─────────┐          │
│  │   512px     │  256px  │          │
│  │  PRESERVE   │ GENERATE│          │
│  │   (black)   │ (white) │          │
│  └─────────────┴─────────┘          │
└──────────────────────────────────────┘
```

**Mask Format:**
- Single-channel grayscale PNG
- 0 (black): Preserve existing pixels
- 255 (white): Generate new content

**Why Masking is Critical:**
Without explicit masks, outpainting models tend to:
- Redraw the entire canvas (including preserved areas)
- Cause cumulative degradation ("feedback loop")
- Create hard edges and discontinuities

With masks:
- Left 512px remains pixel-perfect from previous iteration
- Only right 256px is generated
- Smooth blending at mask boundaries
- No cumulative quality loss

### Stitching Algorithm

```javascript
// First segment: use full 768px width
composite operations for segment 0: full 768x512

// Subsequent segments: only append new 256px portion
for (i = 1 to 23) {
  extract right 256px from segment_i
  composite at x = 768 + ((i - 1) * 256)
}

// Final panorama dimensions:
width = 768 + (23 * 256) = 6656 pixels
height = 512 pixels
```

This avoids double-counting the overlap regions and creates a true continuous panorama.

### Iterative Seed Preparation

After each segment generation:
```javascript
// Extract rightmost 512px as seed for next iteration
const croppedSeed = await sharp(segmentBuffer)
  .extract({
    width: 512,
    height: 512,
    left: 256,  // Skip left 256px, take right 512px
    top: 0
  })
  .toFile(`seed_${i+1}.png`)
```

This 512px seed becomes the "previous landscape" that the next prompt references and the next generation preserves.

## Prompt Generation Strategy

### Chained Narrative Approach

Each prompt builds on the previous, creating a flowing story:

```
Prompt 1 (6 AM):  "mountains, turquoise lake, pine forests at dawn"
                         ↓
Prompt 2 (7 AM):  "Seamlessly extending from [Prompt 1], meadow with dew-kissed wildflowers..."
                         ↓
Prompt 3 (8 AM):  "Seamlessly extending from [Prompt 2], tranquil lake with golden hue..."
                         ↓
                       ...
                         ↓
Prompt 24 (5 AM): "Seamlessly extending from [Prompt 23], dawn light with morning mist..."
```

### Temporal Progression

**Dawn (6-8 AM):**
- Soft, mist-laden atmospheres
- First light, golden hues
- Dew, fog, emerging colors

**Morning (9-11 AM):**
- Brightening sunlight
- Clear skies, vibrant colors
- Active, sun-drenched landscapes

**Midday (12-2 PM):**
- Peak brightness
- Strong contrasts, sharp shadows
- Radiant, luminous quality

**Afternoon (3-5 PM):**
- Softening light
- Lengthening shadows
- Warm, golden tones

**Evening (6-8 PM):**
- Twilight glow
- Dusky skies, fading light
- Ethereal, mystical quality

**Night (9 PM-5 AM):**
- Moonlight, starlight
- Silvery sheens, cool tones
- Mysterious, tranquil atmosphere

**Pre-Dawn (4-5 AM):**
- First hints of light
- Pastel hues, misty veils
- Anticipation of new day

### Seasonal Context

By including the current date, prompts automatically adapt to seasons:

**Autumn (Sep-Nov):**
- "autumn colors", "crisp air"
- "fallen leaves", "harvest moon"
- "decaying leaves", "brisk mornings"

**Winter (Dec-Feb):**
- "snow-covered", "frost"
- "bare branches", "icy landscapes"
- "cold", "winter solitude"

**Spring (Mar-May):**
- "blooming wildflowers", "fresh growth"
- "budding trees", "renewal"
- "gentle rain", "vibrant greens"

**Summer (Jun-Aug):**
- "lush greenery", "warm sunlight"
- "clear skies", "vibrant meadows"
- "long days", "golden fields"

## Configuration

### Environment Variables

Create a `.env` file:
```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Dependencies

**Key packages:**
```json
{
  "@langchain/openai": "^0.6.14",
  "langchain": "latest",
  "replicate": "^1.3.0",
  "sharp": "latest",
  "dotenv": "latest",
  "nuxt": "^3.x",
  "vue": "^3.x"
}
```

## Usage

### Generate a Panorama

```bash
# Run the full generation pipeline
node test-full-day-generation.js

# Output:
# - static/images/{date}-full-day/{date}_full_day_landscape.png
# - static/images/{date}-full-day/{date}_prompts.txt
```

### Run the Web Application

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Access at http://localhost:3000
```

### Manual Generation for Specific Date

Modify `test-full-day-generation.js` to use a custom date:
```javascript
const date = '2025-12-25'; // Christmas panorama
```

## Performance Characteristics

### Generation Time

- **Prompt generation**: ~2 minutes (24 prompts with 300ms delay between API calls)
- **Image generation**: ~10-15 minutes (24 segments × 25-40 seconds per segment)
- **Total time**: ~12-17 minutes for full 24-hour panorama

### API Costs (Approximate)

- **OpenAI GPT-3.5-turbo**: ~$0.10 per 24-hour generation (24 prompts)
- **Replicate Stability AI**: ~$2.40 per 24-hour generation (24 segments × ~$0.10/segment)
- **Total**: ~$2.50 per complete panorama

### Storage

- Final panorama: ~2-4 MB (6656x512 PNG)
- Intermediate files: ~50-100 MB (cleaned up after stitching)
- 7-day rolling archive: ~15-30 MB

## Troubleshooting

### Common Issues

**Issue: Prompts are generic/repetitive**
- Check OpenAI API key has sufficient quota
- Verify temperature setting (0.7 is good for creativity)
- Ensure prompt chaining is working (check `previous_description` parameter)

**Issue: Hard edges in panorama**
- Verify mask is correct format (black=preserve, white=generate)
- Check that overlap is 512px (not less)
- Ensure "Seamlessly extend" is in all prompts

**Issue: Cumulative blur/degradation**
- Confirm using mask-based inpainting (not plain outpainting)
- Verify seed cropping extracts correct 512px region
- Check that preserved region isn't being regenerated

**Issue: Generated image doesn't match prompt**
- Increase `guidance_scale` (try 10-12)
- Add more specific details to negative_prompt
- Verify model is stability-ai/stable-diffusion-inpainting

**Issue: Web app shows default image**
- Ensure images are in correct directory: `static/images/{date}/{date}_full_day_landscape.png`
- Copy generated images from `{date}-full-day/` to `{date}/` directory
- Rename `{date}_prompts.txt` to `{date}_generated_descriptions.txt`

## Architecture Decisions

### Why Mask-Based Inpainting?

Initial attempts used pure outpainting models, which:
- Regenerated entire images (not just extensions)
- Caused feedback loop degradation
- Created hard visual boundaries

Mask-based inpainting solves this by:
- Explicitly preserving previous content (pixel-perfect)
- Only generating new regions
- Creating smooth blend zones at boundaries

### Why 512px + 256px (not 512px + 512px)?

- **512px overlap**: Provides sufficient context for AI to understand previous scene
- **256px generation**: Creates manageable chunks while maintaining quality
- **6656px final**: Allows smooth panning over 24 hours (277px per hour average)

Larger generation areas (512px) would:
- Take longer per segment
- Risk more discontinuity
- Not provide significant quality improvement

### Why Stability AI SD Inpainting?

Tested multiple models:
- **FLUX Fill Pro**: Good quality but mask handling issues
- **simbrams/ri**: Good but aggressive schedulers caused problems
- **realistic-vision-v5**: Unwanted upscaling, dimension mismatches
- **Stability AI SD Inpainting**: ✅ Best balance of quality, speed, and reliability

### Why LangChain for Prompts?

- Provides clean prompt template system
- Easy to chain outputs (previous → next)
- Handles OpenAI API calls with retries
- Extensible for future enhancements (memory, RAG, etc.)

## Future Enhancements

### Potential Improvements

1. **Weather Integration**: Incorporate real-time weather data into prompts
2. **Location-Specific**: Generate landscapes matching actual geographic locations
3. **Multi-Day Continuity**: Make Day 2's start connect to Day 1's end
4. **Higher Resolution**: Generate 1024px height for more detail
5. **Video Output**: Create smooth animation panning through the day
6. **Interactive Mode**: Allow users to specify landscape themes
7. **Music Sync**: Generate ambient soundscape matching time of day
8. **Social Sharing**: Allow users to share their favorite time-of-day segments

### Optimization Opportunities

1. **Batch Processing**: Generate multiple segments in parallel
2. **Caching**: Reuse prompts for similar dates/seasons
3. **Progressive Loading**: Stream segments as they're generated
4. **Mobile Optimization**: Generate lower-res versions for mobile devices

## Credits

- **Stability AI**: Stable Diffusion Inpainting model
- **OpenAI**: GPT-3.5-turbo for prompt generation
- **Replicate**: Model hosting and API
- **LangChain**: Prompt orchestration framework
- **Sharp**: High-performance image processing
- **Nuxt.js**: Vue framework for web application

## License

[Add your license information here]

## Support

For issues or questions:
- GitHub Issues: [Repository URL]
- Documentation: This file
- Contact: [Your contact info]
