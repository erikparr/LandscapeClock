# Exquisite Landscape Clock

## Overview

Exquisite Landscape Clock is a unique web application that displays a dynamically changing landscape that evolves throughout the day. It combines real-time clock functionality with AI-generated landscape imagery to create a visually stunning and ever-changing scene.

## Features

- Real-time clock display
- AI-generated landscape that changes with the time of day
- Smooth panning effect across the landscape
- Dynamic background color changes to match the time of day
- Hourly text descriptions of the landscape
- Simulation mode for testing and demonstration

## How It Works

1. **Image Generation**: Every day, a full 24-hour landscape image is generated using AI. This image represents how the landscape changes from midnight to midnight.

2. **Real-time Display**: The application shows the current section of the landscape based on the current time. As time progresses, the view pans across the image, creating a smooth transition effect.

3. **Background Color**: The background color of the application changes gradually throughout the day, simulating the natural light changes from dawn to dusk.

4. **Descriptions**: Each hour has an associated text description of the landscape, providing context and enhancing the visual experience.

5. **Simulation Mode**: Users can activate a simulation mode to see how the landscape changes over time at an accelerated pace.

## Technical Details

### Frontend

The frontend is built using Vue.js and Nuxt.js. Key components include:

- `LandscapeViewer.vue`: The main component responsible for displaying the landscape, time, and descriptions.
- `index.vue`: The page component that integrates the LandscapeViewer.

### Backend

The backend uses Nuxt.js server middleware for image generation and serving:

- `imageGeneration.js`: Handles the daily generation of landscape images and serves them through an API endpoint.

### Image Generation

Landscape images are generated using a Python script (not included in the provided code snippets) that likely utilizes AI models for image creation.

### Styling

The application uses custom CSS for styling, including responsive design and smooth transitions.

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up the Python environment for image generation (details to be provided)
4. Run the development server: `npm run dev`

## Usage

- Visit the application in your web browser
- The landscape will automatically update based on the current time
- Press 'P' to toggle simulation mode

## Contributing

Contributions to the Exquisite Landscape Clock project are welcome. Please follow these steps:

1. Fork the repository
2. Create a new branch: `git checkout -b feature-branch-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-branch-name`
5. Submit a pull request

## License

[Include your chosen license here]

## Acknowledgements

- [List any libraries, resources, or inspirations used in the project]
