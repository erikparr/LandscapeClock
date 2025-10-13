# LandscapeClock - Production Deployment Guide

## Architecture Overview

The production system runs on a distributed architecture:

```
┌─────────────────────────────────────────────┐
│  Vercel Frontend (Production)               │
│  URL: landscapeclock.vercel.app             │
│  - Nuxt.js SSR application                  │
│  - Fetches images via API at runtime        │
│  - Displays 24-hour panorama with panning   │
└─────────────────────────────────────────────┘
                     ↓ reads from
┌─────────────────────────────────────────────┐
│  Vercel Blob Storage                        │
│  - Stores all generated panoramas           │
│  - CDN delivery for fast global access      │
│  - 100GB/month free tier                    │
└─────────────────────────────────────────────┘
                     ↑ writes to
┌─────────────────────────────────────────────┐
│  Railway Worker (Background Service)        │
│  - Node.js worker process                   │
│  - Scheduled generation at 5 PM daily       │
│  - Uses LangChain + Stability AI            │
│  - Uploads to Vercel Blob                   │
│  - Maintains multi-day continuity           │
└─────────────────────────────────────────────┘
```

## Deployed Services

### 1. Railway Worker (Background Generation)

**Platform:** Railway
**Repository:** https://github.com/erikparr/LandscapeClock
**Branch:** main
**Service Type:** Worker (long-running process)

**Configuration:**
- Docker-based deployment
- Node.js 20
- Scheduled cron: Daily at 5 PM
- Health check endpoint: `/health`

**Environment Variables:**
```bash
REPLICATE_API_TOKEN=r8_xxxxx
OPENAI_API_KEY=sk-proj-xxxxx
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
TZ=America/Los_Angeles
RUN_ON_STARTUP=false  # Set to true for testing
NODE_ENV=production
```

**Entry Point:** `railway-worker.js`

**What It Does:**
- Runs daily at 5 PM
- Generates 24 prompts using OpenAI GPT-3.5
- Generates 24 image segments using Stability AI
- Stitches into 6656x512 panorama
- Saves continuity files (final seed + description)
- Uploads everything to Vercel Blob
- Takes ~15 minutes per generation

### 2. Vercel Blob Storage

**Platform:** Vercel Storage
**Type:** Blob Storage
**Connected Project:** landscapeclock

**Stored Files:**
- `YYYY-MM-DD_full_day_landscape.png` (6656x512 panorama)
- `YYYY-MM-DD_final_seed.png` (512x512 seed for next day)
- `YYYY-MM-DD_final_description.txt` (final prompt text)
- `YYYY-MM-DD_prompts.txt` (all 24 prompts)

**Access:**
- Public URLs for all images
- CDN-backed for fast delivery
- Automatic HTTPS

### 3. Vercel Frontend

**Platform:** Vercel
**Repository:** https://github.com/erikparr/LandscapeClock
**Branch:** main
**Framework:** Nuxt.js 3

**Configuration:**
- Build Command: `nuxt build`
- Output Directory: `.output`
- Node Version: 20
- SSR enabled, prerendering disabled for index

**Environment Variables:**
```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx  # Auto-injected when Blob connected
```

**API Routes:**
- `GET /api/current-landscape` - Returns today's and tomorrow's panorama URLs
  - Query param: `simulation_time` (optional, ISO date string)
  - Returns: `{ currentTime, todayImage, tomorrowImage, todayPrompts }`

**Frontend Behavior:**
- Fetches current day's panorama from Blob on load
- Pans image based on current time (0-100% over 24 hours)
- Shows hourly descriptions from prompts file
- Preloads tomorrow's image at 5 PM
- Switches to next day at midnight

## Deployment Process

### Initial Setup (One-Time)

1. **Create Railway Project:**
   ```bash
   # Connect GitHub repo to Railway
   # Select main branch
   # Railway auto-detects Dockerfile
   ```

2. **Set Railway Environment Variables:**
   - Add all variables listed above
   - Ensure `BLOB_READ_WRITE_TOKEN` is set

3. **Create Vercel Blob Storage:**
   - Go to Vercel Dashboard → Storage
   - Create Blob storage
   - Name it (e.g., "landscape-images")

4. **Deploy Frontend to Vercel:**
   ```bash
   vercel --prod
   # Follow prompts to create project
   # Connect Blob storage to project (auto-injects token)
   ```

### Continuous Deployment

**Automatic:**
- Push to `main` branch triggers both Railway and Vercel deploys
- Railway rebuilds Docker image
- Vercel rebuilds frontend

**Manual:**
```bash
# Deploy frontend manually
vercel --prod

# Railway redeploys automatically on git push
# Or use Railway dashboard to trigger manual deploy
```

## Monitoring

### Railway Worker

**Check Status:**
- Railway Dashboard → landscapeclock → Logs
- Look for: "Worker ready. Waiting for scheduled jobs..."
- At 5 PM: Check for generation start

**Health Check:**
```bash
curl https://your-railway-url.up.railway.app/health
```

**Logs:**
```
🚂 Railway Worker Starting...
✅ Worker ready. Waiting for scheduled jobs...
🌐 Health check server running on port 3001

# At 5 PM:
🕔 Scheduled generation triggered at 5 PM
Generating 24 prompts...
✅ Generated 24 prompts
Generating panorama...
✅ Generation complete!
  Panorama: https://blob-url.vercel-storage.com/...
```

### Vercel Frontend

**Check Status:**
- Vercel Dashboard → landscapeclock → Deployments
- Look for green "Ready" status

**Logs:**
- Click on deployment → View Function Logs
- Check for API calls and Blob fetches

**Test API:**
```bash
curl https://landscapeclock.vercel.app/api/current-landscape
```

Expected response:
```json
{
  "currentTime": "2025-10-13T...",
  "todayImage": "https://blob-url.vercel-storage.com/2025-10-13_full_day_landscape...",
  "tomorrowImage": "https://blob-url.vercel-storage.com/2025-10-14_full_day_landscape...",
  "todayPrompts": "https://blob-url.vercel-storage.com/2025-10-13_prompts...",
  "blobInfo": {
    "todayFound": true,
    "tomorrowFound": false,
    "promptsFound": true
  }
}
```

### Vercel Blob

**Check Files:**
- Vercel Dashboard → Storage → Your Blob
- Browse tab to see all uploaded files
- Each day should have 4 files

## Costs

### Current Setup (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Railway Worker | Hobby | $5.00 (or free trial 500hrs) |
| Vercel Frontend | Hobby | $0.00 |
| Vercel Blob | Free Tier | $0.00 (under 100GB) |
| **Stability AI API** | Pay-per-use | ~$2.40/day × 30 = **$72/month** |
| **OpenAI API** | Pay-per-use | ~$0.10/day × 30 = **$3/month** |
| **Total** | | **~$80/month** |

### Cost Optimization

**API Usage:**
- Stability AI: $0.10 per segment × 24 = $2.40/day
- OpenAI: $0.003 per prompt × 24 = $0.072/day

**Potential Savings:**
- Generate every 2-3 days instead of daily: ~50-66% savings
- Use smaller/cheaper models
- Cache prompts for similar dates

## Troubleshooting

### Issue: Railway Worker Not Generating

**Check:**
1. Railway logs show "Worker ready"?
2. Environment variables set (especially BLOB token)?
3. Scheduled time reached (5 PM)?

**Fix:**
- Manually trigger: `curl https://your-railway-url/generate-now`
- Check logs for errors
- Verify API tokens are valid

### Issue: Frontend Shows Default Image

**Check:**
1. API endpoint returns blob URLs?
   ```bash
   curl https://your-site.vercel.app/api/current-landscape
   ```
2. Blob storage contains images for today?
3. Console errors in browser?

**Fix:**
- Check BLOB_READ_WRITE_TOKEN in Vercel env vars
- Verify Blob storage is connected to project
- Check browser network tab for failed requests

### Issue: Images Not Loading (CORS)

**Check:**
- Browser console for CORS errors
- Blob URLs are public access

**Fix:**
- Ensure Blob files have `access: 'public'` when uploaded
- Check Vercel Blob settings

### Issue: API Returns 404

**Check:**
- `server/api/current-landscape.js` exists in repo
- Vercel build logs show API route compiled

**Fix:**
- Ensure file is committed to git
- Redeploy Vercel frontend
- Check routeRules in nuxt.config.ts

## Backup & Recovery

### Backup Strategy

**Vercel Blob:**
- Files persist indefinitely
- No automatic backups
- Manual: Download via Blob dashboard

**Railway Worker:**
- Code in GitHub (version controlled)
- Environment variables stored in Railway
- Export: Railway → Settings → Environment → Copy

**Recommendation:**
- Keep last 7 days of images in Blob (automatic via worker)
- Archive notable panoramas manually
- Document env var values securely (password manager)

### Recovery

**If Railway Worker Fails:**
1. Check logs for error
2. Redeploy from Railway dashboard
3. Manually run generation if needed

**If Vercel Frontend Down:**
1. Check deployment status
2. Rollback to previous deployment if needed
3. Redeploy from CLI: `vercel --prod`

**If Blob Storage Lost:**
1. No automatic recovery
2. Worker will regenerate next day
3. Previous days lost (consider external backup)

## Future Improvements

1. **Monitoring:**
   - Add health check pings (e.g., UptimeRobot)
   - Alert on generation failures
   - Track API usage/costs

2. **Performance:**
   - Cache API responses (edge caching)
   - Optimize image sizes
   - Progressive loading

3. **Features:**
   - Custom domain
   - Analytics
   - User preferences (timezone, speed)
   - Social sharing

4. **Reliability:**
   - Retry logic for failed generations
   - Backup storage (S3/R2)
   - Multi-region deployment

## Maintenance

### Weekly:
- Check Railway logs for errors
- Verify images generating daily
- Monitor API costs

### Monthly:
- Review Vercel Blob storage usage
- Check for outdated dependencies
- Update Railway/Vercel configs as needed

### As Needed:
- Rotate API keys
- Update model versions
- Scale resources if traffic increases

## Support

**Issues:**
- GitHub: https://github.com/erikparr/LandscapeClock/issues
- Railway: https://railway.app/help
- Vercel: https://vercel.com/support

**Documentation:**
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
- Railway: https://docs.railway.app
- Nuxt: https://nuxt.com/docs
