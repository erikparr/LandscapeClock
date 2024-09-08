<template>
  <div class="landscape-viewer" @keydown.p="toggleSimulationMode" tabindex="0" ref="viewerRef">
    <div class="image-container">
      <div 
        class="image-wrapper"
        :style="{ transform: `translateX(${-panPercentage}%)` }"
      >
      <img src="/landscape.png" alt="Landscape" />
      </div>
    </div>
    <div class="time-display">
      {{ formattedTimeOnly }}
    </div>
    <div class="description-container">
      <p>{{ currentDescription }}</p>
    </div>
    <div v-if="isSimulationMode" class="simulation-controls">
      <button @click="toggleSimulation">{{ isRunning ? 'Pause' : 'Start' }} Simulation</button>
      <input v-model.number="simulationSpeed" type="range" min="1" max="1000" />
      <span>Speed: {{ simulationSpeed }}x</span>
    </div>
    <div v-if="isSimulationMode" class="debug-info">
      <p>Current Image: {{ currentImageUrl }}</p>
      <p>Next Image: {{ nextImageUrl }}</p>
      <p>Pan Offset: {{ panOffset.toFixed(2) }}</p>
      <p>Current Date: {{ currentDate }}</p>
      <p>Next Image Loading: {{ isLoadingNextImage ? 'Yes' : 'No' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRuntimeConfig } from '#app'

const config = useRuntimeConfig()
const props = defineProps<{
  currentTime: Date
}>()

const currentImage = ref('/images/default_seed_image.png')
const nextImage = ref('')
const isLoading = ref(false)
const isLoadingNextImage = ref(false)
const error = ref('')
const panPercentage = ref(0)
const lastFetchedDate = ref('')
const isSimulationMode = ref(false)
const isRunning = ref(false)
const simulationSpeed = ref(100)

const descriptions = ref<string[]>([])
const currentDescription = computed(() => {
  const hour = new Date(props.currentTime).getHours()
  return descriptions.value[hour+1] || 'No description available'
})

const currentImageUrl = computed(() => currentImage.value)
const nextImageUrl = computed(() => nextImage.value)

const formattedTimeOnly = computed(() => {
  const time = new Date(props.currentTime)
  return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
})

const currentDate = computed(() => new Date(props.currentTime).toISOString().split('T')[0])

function updatePanOffset() {
  const currentTime = new Date(props.currentTime)
  const totalSeconds = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds()
  const dayProgress = totalSeconds / 86400 // 86400 seconds in a day
  
  panPercentage.value = dayProgress * 100

  // Check if we need to switch to the next day's imagef
  // if (dayProgress === 0 && nextImage.value) {
  //   console.log('Day changed. Switching to next image.')
  //   currentImage.value = nextImage.value
  //   nextImage.value = ''
  //   fetchNextDayImage() // Fetch the next day's image
  // }

  // // Start loading next day's image at 17:00
  // if (currentTime.getHours() === 17 && currentTime.getMinutes() === 0 && currentTime.getSeconds() === 0) {
  //   fetchNextDayImage()
  // }
}

let animationFrameId: number | null = null

// watch(() => currentDate.value, (newDate, oldDate) => {
//   console.log(`Date changed from ${oldDate} to ${newDate}`)
//   fetchCurrentLandscape()
// }, { immediate: true })
await fetchDescription()

async function fetchCurrentLandscape() {
  if (currentDate.value === lastFetchedDate.value) {
    return // Image for the current date is already loaded
  }

  isLoading.value = true
  error.value = ''
  try {
    const url = new URL('/api/current-landscape', config.public.baseURL)
    if (isSimulationMode.value) {
      url.searchParams.set('simulation_time', new Date(props.currentTime).toISOString())
    }
    
    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    currentImage.value = data.todayImage
    lastFetchedDate.value = currentDate.value
    console.log('Fetched current image URL:', data.todayImage)
    
    if (data.tomorrowImage) {
      nextImage.value = data.tomorrowImage
      console.log('Fetched next image URL:', data.tomorrowImage)
    }

    // Fetch and parse descriptions
    await fetchDescriptions(data.todayImage)
  } catch (err) {
    console.error('Error fetching landscape data:', err)
    error.value = 'Failed to load landscape data'
  } finally {
    isLoading.value = false
  }
}

async function fetchDescription() {
  try {

    // Construct the full URL using config.public.baseURL
    const descriptionUrl = `generated_descriptions.txt`;
    console.log('Fetching descriptions from:', descriptionUrl);

    const response = await fetch(descriptionUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    descriptions.value = text.split('\n\n').map(desc => desc.trim());
    console.log('Fetched descriptions:', descriptions.value);
  } catch (err) {
    console.error('Error fetching descriptions:', err);
    descriptions.value = [];
  }
}


async function fetchDescriptions(imageUrl: string) {
  try {
    // Extract the date and file name from the image URL
    const urlParts = imageUrl.split('/');
    const date = urlParts[urlParts.length - 2]; // Assumes format like '/images/2024-08-27/2024-08-27_full_day_landscape.png'

    // Construct the full URL using config.public.baseURL
    const descriptionUrl = `generated_descriptions.txt`;
    console.log('Fetching descriptions from:', descriptionUrl);

    const response = await fetch(descriptionUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    descriptions.value = text.split('\n\n').map(desc => desc.trim());
    console.log('Fetched descriptions:', descriptions.value);
  } catch (err) {
    console.error('Error fetching descriptions:', err);
    descriptions.value = [];
  }
}

async function fetchNextDayImage() {
  if (isLoadingNextImage.value) return // Prevent multiple simultaneous requests

  isLoadingNextImage.value = true
  try {
    const nextDay = new Date(props.currentTime)
    nextDay.setDate(nextDay.getDate() + 1)
    
    const url = new URL('/api/current-landscape', config.public.baseURL)
    if (isSimulationMode.value) {
      url.searchParams.set('simulation_time', nextDay.toISOString())
    }
    
    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    if (data.todayImage) {
      nextImage.value = data.todayImage
      console.log('Fetched next day image URL:', data.todayImage)
    }
  } catch (err) {
    console.error('Error fetching next day landscape data:', err)
  } finally {
    isLoadingNextImage.value = false
  }
}

function handleImageError(event: Event) {
  console.error('Image failed to load:', (event.target as HTMLImageElement).src)
  ;(event.target as HTMLImageElement).src = '/images/default_seed_image.png'
}

function toggleSimulationMode() {
  isSimulationMode.value = !isSimulationMode.value
  if (!isSimulationMode.value) {
    stopSimulation()
  }
}

function toggleSimulation() {
  if (isRunning.value) {
    stopSimulation()
  } else {
    startSimulation()
  }
}

function startSimulation() {
  isRunning.value = true
  simulateTime()
}

function stopSimulation() {
  isRunning.value = false
}

const emit = defineEmits(['update:currentTime'])

function simulateTime() {
  if (!isRunning.value) return
  const newTime = new Date(props.currentTime.getTime() + 1000 * simulationSpeed.value)
  emit('update:currentTime', newTime)
  setTimeout(simulateTime, 1000 / simulationSpeed.value)
}

onMounted(() => {
  console.log('Component mounted, current image:', currentImage.value)
  animate()
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})

const viewerRef = ref<HTMLElement | null>(null)

function updateBackgroundColor() {
  if (!viewerRef.value) return

  const currentTime = new Date(props.currentTime)
  const hours = currentTime.getHours()
  const minutes = currentTime.getMinutes()
  const timeProgress = (hours + minutes / 60) / 24

  // Define color stops for different times of day
  const colorStops = [
    { time: 0, color: { r: 10, g: 10, b: 35 } },    // Midnight (dark blue)
    { time: 0.25, color: { r: 255, g: 200, b: 100 } }, // Sunrise (light orange)
    { time: 0.5, color: { r: 200, g: 230, b: 255 } },  // Midday (light blue)
    { time: 0.75, color: { r: 255, g: 140, b: 50 } },  // Sunset (orange)
    { time: 1, color: { r: 10, g: 10, b: 35 } }     // Back to Midnight
  ]

  // Find the two color stops to interpolate between
  let startIndex = 0
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (timeProgress >= colorStops[i].time && timeProgress < colorStops[i + 1].time) {
      startIndex = i
      break
    }
  }

  const startColor = colorStops[startIndex].color
  const endColor = colorStops[startIndex + 1].color
  const startTime = colorStops[startIndex].time
  const endTime = colorStops[startIndex + 1].time

  // Calculate the interpolation factor
  const factor = (timeProgress - startTime) / (endTime - startTime)

  // Interpolate between the two colors
  const r = Math.round(startColor.r + factor * (endColor.r - startColor.r))
  const g = Math.round(startColor.g + factor * (endColor.g - startColor.g))
  const b = Math.round(startColor.b + factor * (endColor.b - startColor.b))

  // Set the CSS variable
  viewerRef.value.style.setProperty('--background-color', `rgb(${r}, ${g}, ${b})`)
}

// Update the existing animate function to include background color update
function animate() {
  updatePanOffset()
  updateBackgroundColor()
  animationFrameId = requestAnimationFrame(animate)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@font-face {
  font-family: 'New Amsterdam';
  src: url('/fonts/NewAmsterdam-Regular.ttf') format('ttf');
  font-weight: normal;
  font-style: normal;
}

.landscape-viewer {
  height: 100vh;
  overflow: hidden;
  position: relative;
  background-color: var(--background-color, #ffffff);
  transition: background-color 1s linear;
}

.image-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center; /* This centers the content vertically */
  justify-content: center;
}

.image-wrapper {
  width: 100%;
  height: 80vh; /* Adjust this value to control image height */
  display: flex;
  align-items: center; /* This centers the image vertically within the wrapper */
  transition: transform 0.1s linear;
}

.image-wrapper img {
  height: 100%;
  width: auto;
  object-fit: cover;
}

.time-display {
  position: absolute;
  top: 2vh;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'New Amsterdam', serif;
  font-size: 4rem;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px 20px;
  border-radius: 15px;
  text-align: center;
  z-index: 10;
}

.description-container {
  position: absolute;
  bottom: 2vh;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 800px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 15px;
  z-index: 10;
}

.description-container p {
  font-family: 'Inter', sans-serif;
  font-size: 1.2rem;
  color: #333;
  margin: 0;
  text-align: center;
}

.simulation-controls, .debug-info {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.simulation-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-info {
  bottom: 50px;
  font-size: 12px;
}
</style>