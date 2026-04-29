require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

const authRoutes = require('./routes/auth')
const tradeRoutes = require('./routes/trades')
const earningsRoutes = require('./routes/earnings')  
const marketsRoutes = require('./routes/markets')  

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'https://ckaddouh.github.io']
}))
app.use(express.json())


app.get('/', (req, res) => {
  res.json({ message: 'TradeTracker server is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/trades', tradeRoutes)
app.use('/api/earnings', earningsRoutes)
app.use('/api/markets', marketsRoutes)

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running at http://localhost:${process.env.PORT || 3000}`)
    })
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  })