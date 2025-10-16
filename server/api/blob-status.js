/**
 * API endpoint to check the status of all blobs in Vercel Blob storage
 * Returns detailed information about generated images and their dates
 */

import { list } from '@vercel/blob';

export default defineEventHandler(async (event) => {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return {
            error: 'BLOB_READ_WRITE_TOKEN not available',
            status: 'unavailable'
        };
    }

    try {
        const { blobs } = await list({
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        // Filter and sort landscape images
        const landscapeImages = blobs
            .filter(blob => blob.pathname.includes('_full_day_landscape'))
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        // Filter and sort prompt files
        const promptFiles = blobs
            .filter(blob => blob.pathname.includes('_prompts'))
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        // Filter and sort continuity files
        const continuityFiles = blobs
            .filter(blob => blob.pathname.includes('_continuity'))
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        const todayImage = blobs.find(blob => blob.pathname.includes(`${today}_full_day_landscape`));

        // Prepare response with detailed information
        const response = {
            summary: {
                totalBlobs: blobs.length,
                landscapeImages: landscapeImages.length,
                promptFiles: promptFiles.length,
                continuityFiles: continuityFiles.length,
                todayDate: today,
                todayImageExists: !!todayImage
            },
            landscapeImages: landscapeImages.map(blob => {
                const dateMatch = blob.pathname.match(/(\d{4}-\d{2}-\d{2})/);
                const imageDate = dateMatch ? dateMatch[1] : 'unknown';
                const uploadDate = new Date(blob.uploadedAt);
                const hoursAgo = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60);

                return {
                    date: imageDate,
                    uploadedAt: blob.uploadedAt,
                    hoursAgo: Math.round(hoursAgo * 10) / 10,
                    sizeMB: Math.round(blob.size / 1024 / 1024 * 100) / 100,
                    pathname: blob.pathname,
                    url: blob.url
                };
            }),
            promptFiles: promptFiles.map(blob => {
                const dateMatch = blob.pathname.match(/(\d{4}-\d{2}-\d{2})/);
                return {
                    date: dateMatch ? dateMatch[1] : 'unknown',
                    uploadedAt: blob.uploadedAt,
                    pathname: blob.pathname,
                    url: blob.url
                };
            }),
            continuityFiles: continuityFiles.map(blob => {
                const dateMatch = blob.pathname.match(/(\d{4}-\d{2}-\d{2})/);
                return {
                    date: dateMatch ? dateMatch[1] : 'unknown',
                    uploadedAt: blob.uploadedAt,
                    pathname: blob.pathname,
                    url: blob.url
                };
            })
        };

        // Add latest image info if available
        if (landscapeImages.length > 0) {
            const latest = landscapeImages[0];
            const latestDate = new Date(latest.uploadedAt);
            const hoursAgo = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60);

            response.latestImage = {
                uploadedAt: latest.uploadedAt,
                hoursAgo: Math.round(hoursAgo * 10) / 10,
                status: hoursAgo < 25 ? 'healthy' : hoursAgo < 49 ? 'warning' : 'error',
                message: hoursAgo < 25
                    ? 'System running correctly'
                    : hoursAgo < 49
                    ? 'Last image over 24 hours old'
                    : 'Last image more than 48 hours old'
            };
        }

        return response;

    } catch (error) {
        console.error('Error checking blob status:', error);
        return {
            error: error.message,
            status: 'error'
        };
    }
});
