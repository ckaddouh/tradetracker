**Project name:** TradeTrackr

**The problem:** TradeTrackr is a web application that lets you track your trade ideas and actually see how they play out without risking real money. You can check on the performance of your ideas daily and see how your portfolio has been doing historically. This is for the new/intermediate investor who wants to sharpen their skills. 

**It will have:**
- A page to view your journal entries (which will include a stock name, position, reasoning, and date)
- A page to view the performance of your ideas over time
- A page to view upcoming earnings reports to be able to have this information all in one place. 

**Data model:**
1. users
_id
email
passwordHash
name
createdAt
settings (theme, preferences)

2. ideas
_id
userId (FK → users)
ticker
title
direction (bullish / bearish / neutral)
thesis (text)
catalysts (array of strings)
timeHorizon (short / medium / long)
status (researching / active / closed)
tags (array)
createdAt
updatedAt

3. idea_updates
_id
ideaId (FK → ideas)
type (note / trade_added / thesis_update / earnings_reaction)
content (text)
createdAt

4. trades
_id
userId
ideaId (FK → ideas)
ticker
type (stock / option)
quantity
entryPrice
currentPrice
openedAt
closedAt
status (open / closed)

6. earnings_events
_id
ticker
companyName
earningsDate
time (BMO / AMC)
source (API provider)

7. watchlist
_id
userId
ticker
notes
createdAt

API endpoint table:
**Auth:**
POST	/api/auth/register	Create user
POST	/api/auth/login	Login user
GET	/api/auth/me	Get current user

**Ideas:**
GET	/api/ideas	Get all user ideas
POST	/api/ideas	Create new idea
GET	/api/ideas/:id	Get single idea
PUT	/api/ideas/:id	Update idea
DELETE	/api/ideas/:id	Delete idea

**Idea Updates:**
GET	/api/ideas/:id/updates	Get timeline updates
POST	/api/ideas/:id/updates	Add update

**Trades:**
GET	/api/trades	Get all trades
POST	/api/trades	Create trade
GET	/api/trades/:id	Get trade
PUT	/api/trades/:id	Update trade
DELETE	/api/trades/:id	Delete trade

**Earnings Calendar:**
GET	/api/earnings	Get earnings (filter by date/ticker)

**Portfolio:**
GET	/api/portfolio	Get portfolio summary
GET	/api/portfolio/performance	Equity curve / P&L


**Watchlist:**
GET	/api/watchlist	Get watchlist
POST	/api/watchlist	Add ticker
DELETE	/api/watchlist/:id	Remove ticker


**Authentication:** The app needs authentication because users must be able to track their own trade ideas without seeing other users' ideas. 
