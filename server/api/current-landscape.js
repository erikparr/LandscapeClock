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

        const response = {
            currentTime: now.toISOString(),
            todayImage: todayImage?.url || '/images/default_seed_image.png',
            tomorrowImage: tomorrowImage?.url || null,
            todayPrompts: todayPrompts?.url || null,
            blobInfo: {
                todayFound: !!todayImage,
                tomorrowFound: !!tomorrowImage,
                promptsFound: !!todayPrompts
            }
        };

        console.log('Landscape API response:', {
            today,
            tomorrow: tomorrowStr,
            todayImageFound: !!todayImage,
            tomorrowImageFound: !!tomorrowImage
        });

        return response;

    } catch (error) {
        console.error('Error fetching landscape from Vercel Blob:', error);

        // Fallback to default image
        return {
            currentTime: now.toISOString(),
            todayImage: '/images/default_seed_image.png',
            tomorrowImage: null,
            error: error.message
        };
    }
});
