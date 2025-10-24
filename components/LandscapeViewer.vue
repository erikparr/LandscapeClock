<template>
  <div class="landscape-viewer" @keydown.p="toggleSimulationMode" tabindex="0" ref="viewerRef">
    <!-- Loading Overlay -->
    <transition name="fade">
      <div v-if="isImageLoading" class="loading-overlay" :style="loadingBackgroundStyle">
        <div class="loading-content">
          <p class="loading-text">{{ loadingText }}<span v-if="isLoadingTyping" class="cursor">|</span></p>
        </div>
      </div>
    </transition>

    <div class="image-container">
      <div
        class="image-wrapper"
        :style="{ transform: `translateX(-${panOffset}px)` }"
      >
        <img
          :src="currentImageUrl"
          alt="Current Landscape"
          @error="handleImageError"
          @load="handleImageLoad"
          ref="imageElement"
        />
      </div>
    </div>
    <div class="time-display">
      {{ formattedTimeOnly }}
    </div>
    <div class="description-container">
      <p class="typewriter-text">{{ displayedDescription }}<span v-if="isTyping" class="cursor">|</span></p>
    </div>
    <div v-if="isSimulationMode" class="simulation-controls">
      <button @click="toggleSimulation">{{ isRunning ? 'Pause' : 'Start' }} Simulation</button>
      <input v-model.number="simulationSpeed" type="range" min="1" max="1000" />
      <span>Speed: {{ simulationSpeed }}x</span>
    </div>
    <div v-if="isSimulationMode" class="debug-info">
      <p>Current Image: {{ currentImageUrl }}</p>
      <p>Next Image: {{ nextImageUrl }}</p>
      <p>Pan Offset: {{ panOffset.toFixed(0) }}px</p>
      <p>Current Date: {{ currentDate }}</p>
      <p>Next Image Loading: {{ isLoadingNextImage ? 'Yes' : 'No' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  currentTime: Date
}>()

const currentImage = ref('/images/default_seed_image.png')
const nextImage = ref('')
const isLoading = ref(false)
const isLoadingNextImage = ref(false)
const isImageLoading = ref(true)
const imageElement = ref<HTMLImageElement | null>(null)
const error = ref('')
const panOffset = ref(0) // in pixels
const lastFetchedDate = ref('')
const isSimulationMode = ref(false)
const isRunning = ref(false)
const simulationSpeed = ref(100)
const isMounted = ref(false)

// Typewriter effect state
const displayedDescription = ref('')
const fullDescription = ref('')
const isTyping = ref(false)
const typewriterInterval = ref<NodeJS.Timeout | null>(null)
const TYPEWRITER_SPEED = 30 // milliseconds per character

// Loading screen typewriter state
const loadingText = ref('')
const isLoadingTyping = ref(false)
const loadingTypewriterInterval = ref<NodeJS.Timeout | null>(null)

const descriptions = ref<string[]>([])
const currentDescription = computed(() => {
  if (!isMounted.value) return 'Loading landscape...'
  const hour = new Date(props.currentTime).getHours()

  // Adjust hour index to match panorama start (6 AM = index 0)
  let hourIndex = hour - 6
  if (hourIndex < 0) {
    hourIndex += 24
  }

  return descriptions.value[hourIndex] || 'Loading landscape...'
})

const currentImageUrl = computed(() => currentImage.value)
const nextImageUrl = computed(() => nextImage.value)

const formattedTimeOnly = computed(() => {
  const time = new Date(props.currentTime)
  return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
})

const currentDate = computed(() => new Date(props.currentTime).toISOString().split('T')[0])

// Time-aware loading screen background
const loadingBackgroundStyle = computed(() => {
  const hour = new Date(props.currentTime).getHours()

  if (hour >= 6 && hour < 12) {
    return { background: 'linear-gradient(135deg, #87CEEB 0%, #FFE5B4 100%)' } // Morning
  } else if (hour >= 12 && hour < 18) {
    return { background: 'linear-gradient(135deg, #87CEEB 0%, #90EE90 100%)' } // Afternoon
  } else if (hour >= 18 && hour < 22) {
    return { background: 'linear-gradient(135deg, #FF6B6B 0%, #4A90E2 100%)' } // Evening
  } else {
    return { background: 'linear-gradient(135deg, #0A0E27 0%, #1A237E 100%)' } // Night
  }
})

// Typewriter effect watcher
watch(() => currentDescription.value, (newDesc) => {
  if (newDesc === fullDescription.value) return

  // Clear existing typewriter
  if (typewriterInterval.value) {
    clearInterval(typewriterInterval.value)
  }

  fullDescription.value = newDesc
  displayedDescription.value = ''
  isTyping.value = true

  // Start typewriter effect
  let charIndex = 0
  const chars = newDesc.split('')

  typewriterInterval.value = setInterval(() => {
    if (charIndex < chars.length) {
      displayedDescription.value += chars[charIndex]
      charIndex++
    } else {
      if (typewriterInterval.value) {
        clearInterval(typewriterInterval.value)
        typewriterInterval.value = null
      }
      isTyping.value = false
    }
  }, TYPEWRITER_SPEED)
})

// Loading typewriter watcher
watch(() => isImageLoading.value, (newVal) => {
  if (newVal) {
    startLoadingTypewriter()
  }
})

function startLoadingTypewriter() {
  // Clear existing typewriter
  if (loadingTypewriterInterval.value) {
    clearInterval(loadingTypewriterInterval.value)
  }

  const fullText = 'Loading'
  loadingText.value = ''
  isLoadingTyping.value = true

  let charIndex = 0
  const chars = fullText.split('')

  loadingTypewriterInterval.value = setInterval(() => {
    if (charIndex < chars.length) {
      loadingText.value += chars[charIndex]
      charIndex++
    } else {
      if (loadingTypewriterInterval.value) {
        clearInterval(loadingTypewriterInterval.value)
        loadingTypewriterInterval.value = null
      }
      isLoadingTyping.value = false
    }
  }, TYPEWRITER_SPEED)
}

function handleImageLoad() {
  isImageLoading.value = false
  // Clear loading typewriter when image loads
  if (loadingTypewriterInterval.value) {
    clearInterval(loadingTypewriterInterval.value)
    loadingTypewriterInterval.value = null
  }
}

function updatePanOffset() {
  const currentTime = new Date(props.currentTime)
  const currentHours = currentTime.getHours()
  const currentMinutes = currentTime.getMinutes()
  const currentSeconds = currentTime.getSeconds()

  // Panorama starts at 6 AM, so adjust the hour offset
  // If before 6 AM (0-5), we're showing the end of yesterday's panorama
  // If at or after 6 AM (6-23), we're showing today's panorama
  let adjustedHours = currentHours - 6
  if (adjustedHours < 0) {
    adjustedHours += 24  // Wrap around (e.g., 3 AM = hour -3 → hour 21)
  }

  const totalSeconds = adjustedHours * 3600 + currentMinutes * 60 + currentSeconds
  const dayProgress = totalSeconds / 86400 // 86400 seconds in a day

  // Calculate pixel-based pan offset
  const imageWidth = 6656 // Panorama width in pixels
  const viewportWidth = window.innerWidth
  const targetPosition = dayProgress * imageWidth
  const idealOffset = targetPosition - (viewportWidth / 2)

  // Clamp offset to valid range [0, imageWidth - viewportWidth]
  panOffset.value = Math.max(0, Math.min(idealOffset, imageWidth - viewportWidth))

  // Check if we need to switch to the next day's image at 6 AM
  if (currentHours === 6 && currentMinutes === 0 && currentSeconds === 0 && nextImage.value) {
    console.log('Day changed at 6 AM. Switching to next image.')
    currentImage.value = nextImage.value
    nextImage.value = ''
    fetchNextDayImage() // Fetch the next day's image
  }

  // Start loading next day's image at 17:00
  if (currentHours === 17 && currentMinutes === 0 && currentSeconds === 0) {
    fetchNextDayImage()
  }
}

let animationFrameId: number | null = null

watch(() => currentDate.value, (newDate, oldDate) => {
  console.log(`Date changed from ${oldDate} to ${newDate}`)
  fetchCurrentLandscape()
}, { immediate: true })

async function fetchCurrentLandscape() {
  if (currentDate.value === lastFetchedDate.value) {
    return // Image for the current date is already loaded
  }

  isLoading.value = true
  isImageLoading.value = true
  error.value = ''
  try {
    // Use relative URL for production compatibility
    let url = '/api/current-landscape'
    if (isSimulationMode.value) {
      url += `?simulation_time=${new Date(props.currentTime).toISOString()}`
    }

    const response = await fetch(url)
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

    // Fetch and parse descriptions from Blob storage
    if (data.todayPrompts) {
      await fetchDescriptionsFromUrl(data.todayPrompts)
    } else {
      console.warn('No prompts URL available')
      descriptions.value = []
    }
  } catch (err) {
    console.error('Error fetching landscape data:', err)
    error.value = 'Failed to load landscape data'
  } finally {
    isLoading.value = false
  }
}

async function fetchDescriptionsFromUrl(promptsUrl: string) {
  try {
    console.log('Fetching descriptions from:', promptsUrl);

    const response = await fetch(promptsUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    // Parse prompts file - remove numbering (e.g., "1. " prefix)
    descriptions.value = text.split('\n\n').map(desc => desc.trim().replace(/^\d+\.\s*/, ''));
    console.log('Fetched descriptions:', descriptions.value.length, 'descriptions');
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

    // Use relative URL for production compatibility
    let url = '/api/current-landscape'
    if (isSimulationMode.value) {
      url += `?simulation_time=${nextDay.toISOString()}`
    }

    const response = await fetch(url)
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
  isMounted.value = true
  animate()
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  if (typewriterInterval.value) {
    clearInterval(typewriterInterval.value)
  }
  if (loadingTypewriterInterval.value) {
    clearInterval(loadingTypewriterInterval.value)
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
  height: 80vh; /* Adjust this value to control image height */
  display: flex;
  align-items: center; /* This centers the image vertically within the wrapper */
  transition: transform 0.1s linear;
  /* No width constraint - let it size to image content */
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

/* Loading Overlay Styles */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: background 1s ease;
}

.loading-content {
  text-align: center;
  color: white;
}

.loading-text {
  font-family: 'Inter', sans-serif;
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Fade transition for loading overlay */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Typewriter effect styles */
.typewriter-text {
  font-family: 'Inter', sans-serif;
  font-size: 1.2rem;
  color: #333;
  margin: 0;
  text-align: center;
}

.cursor {
  animation: blink 0.7s infinite;
  margin-left: 2px;
  font-weight: 300;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>