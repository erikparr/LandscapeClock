<template>
  <div>
    <LandscapeViewer :currentTime="currentTime" />
  </div>
</template>

<script setup lang="ts">
import '~/assets/css/main.css'
import { ref, onMounted, onUnmounted } from 'vue'
import LandscapeViewer from '~/components/LandscapeViewer.vue'

const currentTime = ref(new Date())

function updateTime() {
  currentTime.value = new Date()
}

let intervalId: NodeJS.Timeout | null = null

onMounted(() => {
  intervalId = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

