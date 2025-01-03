export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      baseURL: process.env.BASE_URL || 'http://localhost:3000'
    }
  },
  nitro: {
    static: true,
    plugins: ['~/server/plugins/initializeImages.js'],
    publicAssets: [
      {
        dir: 'static',
        maxAge: 60 * 60 * 24 * 365 // 1 year
      }
    ]
  },
  vite: {
    server: {
      fs: {
        allow: ['.']
      }
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
  routeRules: {
    '/images/**': { static: true }
  },
  // Add this to ensure static files are served correctly
  experimental: {
    payloadExtraction: false
  },
  // Explicitly set the public directory
  dir: {
    public: 'static'
  }
})