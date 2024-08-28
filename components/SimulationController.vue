<template>
    <div>
      <button @click="startSimulation">Start Simulation</button>
      <button @click="stopSimulation">Stop Simulation</button>
      <input v-model="accelerationFactor" type="number" min="1" max="3600" />
      <span>Acceleration Factor: {{ accelerationFactor }}x</span>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, onUnmounted } from 'vue'
  
  const currentTime = ref(new Date())
  const accelerationFactor = ref(36) // 1 second = 1 hour by default
  let intervalId: NodeJS.Timeout | null = null
  
  const emit = defineEmits(['update:currentTime'])
  
  function startSimulation() {
    if (intervalId) clearInterval(intervalId)
    
    intervalId = setInterval(() => {
      currentTime.value = new Date(currentTime.value.getTime() + 60000 * accelerationFactor.value)
      emit('update:currentTime', currentTime.value)
    }, 1000)
  }
  
  function stopSimulation() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
  
  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
  })
  </script>