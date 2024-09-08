export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      baseURL: process.env.BASE_URL || 'http://localhost:3000'
    }
  },
  app: {
    baseURL: '/'
  },
  // Remove the router options if they exist
  // router: {
  //   options: {
  //     strict: false
  //   }
  // },
  // Add this new configuration
  // Add this to ensure static files are served correctly
  experimental: {
    payloadExtraction: false
  },
  // Explicitly set the public directory
  dir: {
    public: 'static'
  }
})