# TradeTrackr — Step-by-Step Setup Guide

## Prerequisites
- Node.js 22 (LTS) — check with `node -v`
- npm 10+
- MongoDB Atlas account
- Thunder Client extension in VS Code

## 1. Clone and install

```bash
git clone https://github.com/ckaddouh/tradetrackr.git
cd tradetrackr/server
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | What it is |
|---|---|
| `PORT` | Port the server listens on (e.g. `3000`) |
| `MONGO_URI` | Your MongoDB Atlas connection string — found in Atlas → Connect → Drivers |
| `JWT_SECRET` | A long random string used to sign tokens — generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | How long tokens last (e.g. `7d`) |

**Never commit `.env`.** It is listed in `.gitignore`.

## 3. Connect to MongoDB Atlas

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster if you don't have one
3. Under **Database Access**, add a user with read/write permissions
4. Under **Network Access**, allow your IP (or `0.0.0.0/0` for development)
5. Click **Connect → Drivers**, copy the connection string, paste into `MONGO_URI` in your `.env`

## 4. Start the server

```bash
npm run dev
```

You should see: