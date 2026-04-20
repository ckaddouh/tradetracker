<template>
  <div>
    <NavBar />
    <main class="container">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background-color: #0f1117;
  color: #e0e0e0;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem;
}
</style>