import { initializeImageGeneration } from '../middleware/imageGeneration';

export default defineNitroPlugin(async (nitroApp) => {
  console.log('Starting image generation initialization...');
  try {
    await initializeImageGeneration();
    console.log('Image generation initialization completed successfully');
  } catch (error) {
    console.error('Error during image generation initialization:', error);
  }
});