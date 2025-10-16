/**
 * API endpoint to fetch current and next day's landscape images from Vercel Blob
 */

import { list } from '@vercel/blob';

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const simulationTime = query.simulation_time;

    const now = simulationTime ? new Date(simulationTime) : new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Return default during build/prerender when token isn't available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.log('No BLOB_READ_WRITE_TOKEN available (build time), returning defaults');
        return {
            currentTime: now.toISOString(),
            todayImage: '/images/default_seed_image.png',
            tomorrowImage: null,
            todayPrompts: null
        };
    }

    try {
        // List all blobs from Vercel Blob storage
        const { blobs } = await list({
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        // Find today's and tomorrow's panorama images
        const todayImage = blobs.find(blob =>
            blob.pathname.includes(`${today}_full_day_landscape`)
        );

        const tomorrowImage = blobs.find(blob =>
            blob.pathname.includes(`${tomorrowStr}_full_day_landscape`)
        );

        // Find today's prompts file for descriptions
        const todayPrompts = blobs.find(blob =>
            blob.pathname.includes(`${today}_prompts`)
        );

        // Check for continuity files
        const todaySeed = blobs.find(blob =>
            blob.pathname.includes(`${today}_final_seed`)
        );
        const todayDesc = blobs.find(blob =>
            blob.pathname.includes(`${today}_final_description`)
        );

        const response = {
            currentTime: now.toISOString(),
            todayImage: todayImage?.url || '/images/default_seed_image.png',
            tomorrowImage: tomorrowImage?.url || null,
            todayPrompts: todayPrompts?.url || null,
            todayDescription: null,
            blobInfo: {
                todayFound: !!todayImage,
                tomorrowFound: !!tomorrowImage,
                promptsFound: !!todayPrompts,
                todaySeedFound: !!todaySeed,
                todayDescFound: !!todayDesc
            }
        };

        // If debug mode, include all blobs list
        if (query.debug === 'true') {
            response.allBlobs = blobs.map(b => ({
                pathname: b.pathname,
                uploadedAt: b.uploadedAt,
                size: b.size
            }));
        }

        console.log('Landscape API response:', {
            today,
            tomorrow: tomorrowStr,
            todayImageFound: !!todayImage,
            tomorrowImageFound: !!tomorrowImage,
            todaySeedFound: !!todaySeed,
            todayDescFound: !!todayDesc
        });

        return response;

    } catch (error) {
        console.error('Error fetching landscape from Vercel Blob:', error);
        console.error('Error details:', error.stack || error);

        // Fallback to default image
        return {
            currentTime: now.toISOString(),
            todayImage: '/images/default_seed_image.png',
            tomorrowImage: null,
            todayPrompts: null,
            todayDescription: null,
            error: error.message
        };
    }
});
