# STEP-BY-STEP-GUIDE.md — TradeTracker

This is a personal guide to setting up and rebuilding TradeTracker from scratch. 
---

## What this app is

TradeTracker is a full-stack trading journal and market analysis tool. Users can log trade ideas (ticker, direction, time horizon, reasoning), track open and closed positions with live P&L from Yahoo Finance, watch upcoming earnings events, and run a supply chain analyzer that uses SEC EDGAR 10-K filings and a Groq LLM to map out which companies are exposed to a given news event.

The stack is: **Vue 3 + Pinia** on the front-end, **Node/Express** on the back-end, **MongoDB Atlas** as the database, and a handful of external APIs (Yahoo Finance, SEC EDGAR, and Groq).

---

## Back-End Setup

Make sure you have:

- **Node.js v18+** 
- **npm** 
- **nodemon** 
- A **MongoDB Atlas** account (free tier)
- A **Groq API key** (needed for earnings AI summary and market analysis feature)

Then, clone and install

```bash
git clone <your-repo-url>
cd your-project/server
npm install
```

The main dependencies are: `express`, `mongoose`, `dotenv`, `cors`, `bcryptjs`, `jsonwebtoken`, and `axios`. All of these get pulled in automatically from `package.json`.

Next, create a file called `.env` in the `/server` directory and add to .gitignore. 

```
MONGODB_URI=your_mongodb_atlas_connection_string_here
JWT_SECRET=make_this_something_long_and_random
JWT_EXPIRES_IN=7d
PORT=3000
GROQ_API_KEY=your_groq_api_key_here
```

### Connect to MongoDB Atlas

1. Log into [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a new project and a free M0 cluster
3. Under "Database Access" — add a database user with a username and password
4. Under "Network Access" — add your IP address (or `0.0.0.0/0`)
5. Click "Connect" on your cluster → "Drivers" → copy the connection string and paste it into `MONGODB_URI` in the `.env`

### Start the server

```bash
cd server
npm run dev
```

You should see:

```
Connected to MongoDB
Server running at http://localhost:3000
```


### Seed the supply chain data

The analyzer feature depends on supply chain trees being pre-loaded into the database. There's a seed script that fetches 10-K filings from SEC EDGAR and runs them through Groq to build the trees. Run it once after the server is working:

```bash
cd server
node seedSupplyChains.js
```

This script processes companies in batches and is rate-limited deliberately, so it takes a while. There's a `seed-progress.json` file it writes to so it can resume if interrupted. By default it seeds 6-8 companies before it hits a limit. 

### Testing routes in Thunder Client

Install the Thunder Client extension in VS Code. Here are the routes worth testing:

| Method | URL | What to check |
|--------|-----|---------------|
| POST | `http://localhost:3000/api/auth/register` | Body: `{ "email": "test@test.com", "password": "123456" }` → should return 201 |
| POST | `http://localhost:3000/api/auth/login` | Same body → should return a `token` |
| GET | `http://localhost:3000/api/trades` | Add `Authorization: Bearer <token>` header → should return `[]` initially |
| POST | `http://localhost:3000/api/trades` | With auth header + body: `{ "ticker": "AAPL", "direction": "long", "horizon": "weeks", "reason": "test" }` → 201 |
| GET | `http://localhost:3000/api/trades/chart/AAPL?from=1700000000` | Should return Yahoo Finance price data |
| GET | `http://localhost:3000/api/markets/trees` | Should return seeded supply chain trees |

The auth token from the login route needs to go in every protected route as a Bearer token header.

---

## Front-End Setup

### Scaffold the Vite project

The front-end lives in the `/client` folder. To install dependencies:

```bash
cd client
npm install
```

The main dependencies are: `vue`, `vue-router`, `pinia`, `axios`, `chart.js`, and `d3`.

### Environment variable

Create a `.env` file in `/client`:

```
VITE_API_URL=http://localhost:3000
```

The app hardcodes `localhost:3000` in the store files right now, so this variable is there for future-proofing when you swap to a deployed URL. When you deploy (see below), you'll update this to your Railway URL.

### Run the dev server

```bash
cd client
npm run dev
```

Vite will print something like:

```
VITE v8.x.x  ready in 300ms
→  Local:   http://localhost:5173/
```


### How the front-end is structured

Here's the rough layout of what's in `src/`:

```
src/
├── views/
│   ├── HomeView.vue        ← landing page
│   ├── LoginView.vue       ← login form
│   ├── RegisterView.vue    ← register form
│   ├── JournalView.vue     ← the trade journal (built first)
│   ├── EarningsView.vue    ← earnings calendar
│   └── MarketAnalyzer.vue  ← the supply chain / news analyzer (built last)
├── components/
│   ├── NavBar.vue
│   ├── TradeCard.vue       ← individual trade card with chart modal
│   ├── DependencyGraph.vue ← D3 force graph for supply chain viz
│   └── NodePanel.vue       ← side panel when you click a node
├── stores/
│   ├── authStore.js
│   ├── tradeStore.js
│   └── earningsStore.js
├── utils/
│   ├── groqAnalyzer.js     ← calls Groq API from the client
│   └── secEdgar.js         ← SEC EDGAR helpers
└── router/index.js
```

### The order I built things 

I went feature by feature rather than building all the back-end first and all the front-end second. Here's the actual order:

**1. Auth first.** Register and login had to exist before anything else could be tested properly. I built the User model, the `/api/auth/register` and `/api/auth/login` routes, the `verifyToken` middleware, and then the LoginView and RegisterView on the front-end. The `authStore` handles storing the JWT in localStorage and attaching it to every request.

**2. Trade Journal.** I built `TradeIdea.js` (the Mongoose model), the full `/api/trades` route file (GET, POST, PATCH, DELETE), then `tradeStore.js`, then `JournalView.vue` and `TradeCard.vue`. The trickiest part was the chart modal in TradeCard — proxying Yahoo Finance through the server (to avoid CORS), calculating the right entry price, and rendering the coloured Chart.js graph with the dashed idea-date marker.

**3. Earnings Tracker.** After the journal was working, I added the earnings calendar as a separate feature. The `EarningsWatch` model, `/api/earnings` routes, `earningsStore.js`, and `EarningsView.vue`. 

**4. Market Analyzer.** The most complex feature, built last. This involved the SEC EDGAR proxy routes in `/api/markets`, the `SupplyChainTree` model with its flat node structure for text search, the `seedSupplyChains.js` script that pre-populates the DB, and then the `MarketAnalyzer.vue` view with the D3 force graph (`DependencyGraph.vue`) and node detail panel (`NodePanel.vue`).

### Verifying the connection works locally

With both servers running:

1. Go to `http://localhost:5173/register` and create an account
2. Log in — you should be redirected and the nav should show you're logged in
3. Go to `/journal` and create a trade idea
4. Click the card — the chart modal should load with real price data
5. Go to `/markets` and search a ticker that's been seeded — you should see the D3 graph render

---

## Deployment

### Deploy the back-end to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo" → select your repo
3. Railway will auto-detect it's a Node app. Set the **Root Directory** to `server` in the service settings.
4. Add your environment variables in the Railway dashboard under "Variables":
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `GROQ_API_KEY`
   - `PORT` (Railway sets this automatically but it doesn't hurt to include it)
5. Railway will deploy automatically. Once it's live, copy the generated URL — it'll look like `https://your-app.up.railway.app`

Check it's working by visiting `https://your-app.up.railway.app/` — you should get the `{ "message": "TradeTracker server is running" }` response.

### Configure CORS for production

In `server.js`, the CORS origin is hardcoded to `http://localhost:5173`. Before deploying, update it to accept both:

```js
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-github-username.github.io']
}))
```

Redeploy after this change.

### Deploy the front-end to GitHub Pages

1. In `/client/vite.config.js`, set the `base` to your repo name:

```js
export default defineConfig({
  plugins: [vue()],
  base: '/your-repo-name/'
})
```

2. Update your `.env` in `/client` to point at the live Railway URL:

```
VITE_API_URL=https://your-app.up.railway.app
```

Also update any hardcoded `localhost:3000` references in the store files to use this URL.

3. Build the front-end:

```bash
cd client
npm run build
```

4. Deploy the `dist/` folder to GitHub Pages. The easiest way is the `gh-pages` package:

```bash
npm install --save-dev gh-pages
```

Add this to `client/package.json` scripts:

```json
"deploy": "gh-pages -d dist"
```

Then:

```bash
npm run build
npm run deploy
```

5. In your GitHub repo settings → Pages → set the source to the `gh-pages` branch.

The front-end will be live at `https://your-username.github.io/your-repo-name/`.