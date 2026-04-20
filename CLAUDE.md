# TradeTrackr

## What this is
A web application for tracking paper trade ideas and monitoring their performance over time.
Users can journal trade ideas, track P&L, view an earnings calendar, and manage a watchlist —
all without risking real money. Built for new and intermediate investors.

Node.js/Express REST API backend with JSON responses. No frontend framework.

## Stack
- Node.js 22 (LTS)
- Express 4.x
- MongoDB (via Mongoose) for persistence
- JWT for authentication (jsonwebtoken + bcrypt)
- dotenv for environment variables
- Jest for testing
- ESLint for linting
- No TypeScript

See @package.json for all dependencies and available scripts.

## Project structure
- src/index.js: entry point
- src/routes/: route handlers (one file per resource: auth, ideas, trades, earnings, portfolio, watchlist)
- src/middleware/: custom middleware (auth.js for JWT verification, error.js for error handling)
- src/controllers/: business logic (one file per resource)
- src/models/: Mongoose schemas (User, Idea, IdeaUpdate, Trade, EarningsEvent, Watchlist)
- docs/design-spec.md: full design specification
- .env.example: required environment variables with placeholders

## Data models
Six core collections:

1. **users** — _id, email, passwordHash, name, createdAt, settings
2. **ideas** — _id, userId, ticker, title, direction (bullish/bearish/neutral), thesis, catalysts[], timeHorizon (short/medium/long), status (researching/active/closed), tags[], createdAt, updatedAt
3. **idea_updates** — _id, ideaId, type (note/trade_added/thesis_update/earnings_reaction), content, createdAt
4. **trades** — _id, userId, ideaId, ticker, type (stock/option), quantity, entryPrice, currentPrice, openedAt, closedAt, status (open/closed)
5. **earnings_events** — _id, ticker, companyName, earningsDate, time (BMO/AMC), source
6. **watchlist** — _id, userId, ticker, notes, createdAt

## API endpoints

**Auth:**
- POST   /api/auth/register   — Create user
- POST   /api/auth/login      — Login user
- GET    /api/auth/me         — Get current user

**Ideas:**
- GET    /api/ideas           — Get all user ideas
- POST   /api/ideas           — Create new idea
- GET    /api/ideas/:id       — Get single idea
- PUT    /api/ideas/:id       — Update idea
- DELETE /api/ideas/:id       — Delete idea

**Idea Updates (timeline):**
- GET    /api/ideas/:id/updates  — Get timeline updates for an idea
- POST   /api/ideas/:id/updates  — Add update to an idea

**Trades:**
- GET    /api/trades          — Get all trades
- POST   /api/trades          — Create trade
- GET    /api/trades/:id      — Get trade
- PUT    /api/trades/:id      — Update trade
- DELETE /api/trades/:id      — Delete trade

**Earnings Calendar:**
- GET    /api/earnings        — Get earnings events (filter by date or ticker)

**Portfolio:**
- GET    /api/portfolio             — Get portfolio summary
- GET    /api/portfolio/performance — Equity curve / P&L over time

**Watchlist:**
- GET    /api/watchlist       — Get watchlist
- POST   /api/watchlist       — Add ticker
- DELETE /api/watchlist/:id   — Remove ticker

## Authentication
JWT-based. All routes except /api/auth/register and /api/auth/login require a valid token.
- Attach token as: Authorization: Bearer <token>
- Middleware: src/middleware/auth.js verifies the token and attaches req.user
- Passwords hashed with bcrypt before storage
- Users must only be able to access their own ideas, trades, and watchlist — always filter by userId

## Environment variables
See .env.example for all required variables. Required variables include:
- PORT
- MONGO_URI
- JWT_SECRET
- JWT_EXPIRES_IN

When adding a new variable: add it to .env.example with a placeholder.
NEVER read .env directly. Use process.env in code and let dotenv handle loading.

## Commands
- Install:       npm install
- Dev server:    npm run dev
- Tests:         npm test
- Single test:   npm test -- --testPathPattern=filename
- Lint:          npm run lint

## Module system
CommonJS (require/module.exports). Do NOT use ES module syntax (import/export)
unless explicitly asked.

## Code style
- 2-space indentation
- Single quotes for strings
- Async/await preferred over .then() chains
- Always handle errors in async functions with try/catch
- No console.log in committed code
- Return consistent JSON shapes: { data, error, message }

## Rules
- NEVER read or log the contents of .env
- NEVER commit API keys, tokens, or secrets
- ALWAYS update .env.example when adding a new environment variable
- NEVER install new packages without asking first
- Check docs/design-spec.md before building any new feature
- Always scope data queries to the authenticated user (req.user._id) — never expose other users' data

## Git workflow
- Commit after each meaningful, working unit of change
- Commit messages: imperative tense ("Add idea creation endpoint")
- Run npm test before committing
- Never commit with failing tests