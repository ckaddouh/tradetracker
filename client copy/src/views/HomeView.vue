<template>
    <div class="home">
      <h1>Welcome to TradeTrackr</h1>
      <p>Track your trade ideas, measure your conviction, review your outcomes.</p>
      <div class="actions">
        <RouterLink to="/register" class="btn-primary">Get Started</RouterLink>
        <RouterLink to="/login" class="btn-secondary">Login</RouterLink>
      </div>
    </div>
  </template>
  
  <style scoped>
  .home {
    text-align: center;
    margin-top: 5rem;
  }
  
  h1 {
    font-size: 2.5rem;
    color: #4ade80;
    margin-bottom: 1rem;
  }
  
  p {
    color: #888;
    margin-bottom: 2rem;
    font-size: 1.1rem;
  }
  
  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }
  
  .btn-primary {
    background-color: #4ade80;
    color: #0f1117;
    padding: 0.7rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
  }
  
  .btn-secondary {
    border: 1px solid #4ade80;
    color: #4ade80;
    padding: 0.7rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
  }
  </style>