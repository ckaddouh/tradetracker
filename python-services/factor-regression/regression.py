"""
Factor Regression Endpoint
Mount this in your Express/FastAPI app as POST /api/markets/factor-regression

Dependencies:
    pip install fastapi pandas numpy scikit-learn yfinance fredapi statsmodels scipy

Environment variables:
    FRED_API_KEY  — your FRED API key
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from fredapi import Fred
import yfinance as yf
from sklearn.linear_model import LassoCV, Lasso
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import r2_score
from scipy import stats

router = APIRouter()
fred = Fred(api_key=os.environ["FRED_API_KEY"])

# ── FRED series catalogue ──────────────────────────────────────────────────────
# (series_id, human_readable_name, category)
FRED_SERIES = [
    # US Macro
    ("GDP",        "US GDP (Quarterly)",               "US Macro"),
    ("GDPC1",      "US Real GDP (Quarterly)",           "US Macro"),
    ("CPIAUCSL",   "CPI All Items",                     "US Macro"),
    ("CPILFESL",   "Core CPI (ex Food & Energy)",       "US Macro"),
    ("PCEPI",      "PCE Price Index",                   "US Macro"),
    ("PCEPILFE",   "Core PCE Price Index",               "US Macro"),
    ("PPIFIS",     "PPI Final Demand",                   "US Macro"),
    ("UNRATE",     "Unemployment Rate",                  "US Macro"),
    ("PAYEMS",     "Nonfarm Payrolls",                   "US Macro"),
    ("RSXFS",      "Retail Sales (ex Autos)",            "US Macro"),
    ("INDPRO",     "Industrial Production Index",        "US Macro"),
    ("TCU",        "Capacity Utilization",               "US Macro"),
    ("HOUST",      "Housing Starts",                     "US Macro"),
    ("PERMIT",     "Building Permits",                   "US Macro"),
    ("UMCSENT",    "UMich Consumer Sentiment",           "US Macro"),
    ("MANEMP",     "Manufacturing Employment",           "US Macro"),
    ("DGORDER",    "Durable Goods Orders",               "US Macro"),
    ("ISRATIO",    "Inventory-to-Sales Ratio",           "US Macro"),

    # Fed / Rates
    ("FEDFUNDS",   "Federal Funds Rate",                 "Fed & Rates"),
    ("DGS2",       "2Y Treasury Yield",                  "Fed & Rates"),
    ("DGS10",      "10Y Treasury Yield",                 "Fed & Rates"),
    ("DGS30",      "30Y Treasury Yield",                 "Fed & Rates"),
    ("T10Y2Y",     "10Y-2Y Yield Spread",                "Fed & Rates"),
    ("T10Y3M",     "10Y-3M Yield Spread",                "Fed & Rates"),
    ("TEDRATE",    "TED Spread",                         "Fed & Rates"),
    ("M2SL",       "M2 Money Supply",                    "Fed & Rates"),
    ("BOGMBASE",   "Monetary Base",                      "Fed & Rates"),
    ("WALCL",      "Fed Balance Sheet (Total Assets)",   "Fed & Rates"),

    # Global GDP / PMI
    ("CLVMNACSCAB1GQEA19",  "Eurozone Real GDP",         "Global Macro"),
    ("JPNRGDPEXP",           "Japan Real GDP",            "Global Macro"),
    ("GBRRGDPEXP",           "UK Real GDP",               "Global Macro"),
    ("CANRGDPEXP",           "Canada Real GDP",           "Global Macro"),
    ("MKTGDPCNA646NWDB",    "China GDP (World Bank)",    "Global Macro"),
    ("DEURGDPEXP",           "Germany Real GDP",          "Global Macro"),

    # Commodities
    ("DCOILWTICO",  "WTI Crude Oil Price",               "Commodities"),
    ("DCOILBRENTEU","Brent Crude Oil Price",             "Commodities"),
    ("DHHNGSP",     "Natural Gas (Henry Hub)",           "Commodities"),
    ("GOLDAMGBD228NLBM", "Gold Price (London Fix)",      "Commodities"),
    ("SLVPRUSD",    "Silver Price (USD)",                 "Commodities"),
    ("PCOPPUSDM",   "Copper Price (USD)",                 "Commodities"),
    ("PMAIZMTUSDM", "Corn Price (USD)",                  "Commodities"),
    ("PWHEAMTUSDM", "Wheat Price (USD)",                 "Commodities"),
    ("PSOYBUSDQ",   "Soybean Price (USD)",               "Commodities"),
    ("PALLFNFINDEXM","Global Commodity Price Index",     "Commodities"),

    # Credit / Risk
    ("BAMLC0A4CBBB", "BBB Corporate Spread (OAS)",      "Credit & Risk"),
    ("BAMLH0A0HYM2", "High Yield Spread (OAS)",         "Credit & Risk"),
    ("VIXCLS",       "VIX (CBOE Volatility Index)",     "Credit & Risk"),
    ("STLFSI4",      "St. Louis Financial Stress Index","Credit & Risk"),
    ("NFCI",         "Chicago Fed Financial Conditions","Credit & Risk"),

    # FX
    ("DTWEXBGS",   "USD Broad Trade-Weighted Index",    "FX"),
    ("DEXUSEU",    "EUR/USD Exchange Rate",             "FX"),
    ("DEXJPUS",    "USD/JPY Exchange Rate",             "FX"),
    ("DEXCHUS",    "USD/CNY Exchange Rate",             "FX"),
    ("DEXCAUS",    "USD/CAD Exchange Rate",             "FX"),
    ("DEXUSUK",    "USD/GBP Exchange Rate",             "FX"),

    # Equity / Valuation
    ("SP500",      "S&P 500 Index",                     "Equity"),
    ("MULTPL/SHILLER_PE_RATIO_MONTH", "Shiller CAPE Ratio", "Equity"),
    ("A191RL1Q225SBEA", "Real GDP Growth Rate (QoQ)",   "Equity"),

    # Labor / Wages
    ("CES0500000003","Avg Hourly Earnings (All)",       "Labor"),
    ("LNS14000006",  "Unemployment Rate (25-54)",       "Labor"),
    ("JTSJOL",       "Job Openings (JOLTS)",            "Labor"),
    ("ICSA",         "Initial Jobless Claims",          "Labor"),

    # Housing / Real Estate
    ("CSUSHPISA",  "Case-Shiller Home Price Index",     "Housing"),
    ("MORTGAGE30US","30Y Fixed Mortgage Rate",          "Housing"),
    ("EVACANTUSQ176N","Rental Vacancy Rate",            "Housing"),

    # Energy-specific (useful if company is energy sector)
    ("WTISPLC",    "WTI Spot Price (Cushing)",          "Energy"),
    ("GASDESW",    "Diesel Fuel Price",                 "Energy"),
    ("DRGASNYH",   "NY Harbor Gasoline Price",          "Energy"),
]

# ── Pydantic models ────────────────────────────────────────────────────────────
class RegressionRequest(BaseModel):
    ticker: str
    lookback_years: int = 5        # how many years of history
    top_n_factors: int = 15        # how many top factors to return
    lag_weeks: list[int] = [1, 2, 4]   # lags to test (in weeks)

class FactorResult(BaseModel):
    series_id: str
    name: str
    category: str
    lag_weeks: int
    coefficient: float
    direction: str          # "positive" | "negative"
    importance_pct: float   # % of total absolute coefficient weight

class RegressionResponse(BaseModel):
    ticker: str
    company_name: str
    r2_score: float
    r2_adj: float
    n_observations: int
    factors: list[FactorResult]
    predicted_vs_actual: list[dict]   # [{date, actual, predicted}]
    model_note: str

# ── Helpers ────────────────────────────────────────────────────────────────────

def fetch_fred_series(series_id: str, start: str, end: str) -> Optional[pd.Series]:
    """Fetch one FRED series, return None on failure."""
    try:
        s = fred.get_series(series_id, observation_start=start, observation_end=end)
        return s
    except Exception:
        return None


def build_factor_matrix(start: str, end: str, lags: list[int]) -> pd.DataFrame:
    """
    Fetch all FRED series, resample to weekly, forward-fill,
    then create lagged copies for each lag in `lags`.
    Returns a wide DataFrame with columns like "CPIAUCSL_lag1w".
    """
    raw: dict[str, pd.Series] = {}

    for series_id, name, category in FRED_SERIES:
        s = fetch_fred_series(series_id, start, end)
        if s is not None and len(s) > 10:
            # Compute week-over-week % change for stationary series
            s_weekly = s.resample("W-FRI").last().ffill()
            # Use returns (% change) to make stationary
            s_ret = s_weekly.pct_change()
            raw[series_id] = s_ret

    factor_df = pd.DataFrame(raw)

    # Create lagged versions
    lagged_frames = []
    for lag in lags:
        shifted = factor_df.shift(lag)
        shifted.columns = [f"{col}_lag{lag}w" for col in factor_df.columns]
        lagged_frames.append(shifted)

    return pd.concat(lagged_frames, axis=1)


def fetch_stock_returns(ticker: str, start: str, end: str) -> pd.Series:
    """Weekly % returns for the stock."""
    data = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
    if data.empty:
        raise ValueError(f"No price data found for {ticker}")
    weekly = data["Close"].resample("W-FRI").last()
    return weekly.pct_change().rename(ticker)


def run_lasso(X: pd.DataFrame, y: pd.Series, top_n: int):
    """
    LASSO with time-series cross-validation.
    Returns (model, scaler, feature_names, r2, r2_adj, y_pred)
    """
    # Align and drop NaNs
    df = pd.concat([y, X], axis=1).dropna()
    y_clean = df.iloc[:, 0]
    X_clean = df.iloc[:, 1:]

    n, p = X_clean.shape

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_clean)

    # TimeSeriesSplit CV to pick alpha
    tscv = TimeSeriesSplit(n_splits=5)
    lasso_cv = LassoCV(
        cv=tscv,
        max_iter=10000,
        n_alphas=100,
        random_state=42,
    )
    lasso_cv.fit(X_scaled, y_clean)

    y_pred = pd.Series(lasso_cv.predict(X_scaled), index=y_clean.index)

    r2 = r2_score(y_clean, y_pred)
    # Adjusted R²
    r2_adj = 1 - (1 - r2) * (n - 1) / (n - p - 1) if n > p + 1 else r2

    return lasso_cv, scaler, X_clean.columns.tolist(), r2, r2_adj, y_pred, y_clean


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post("/factor-regression", response_model=RegressionResponse)
async def factor_regression(req: RegressionRequest):
    ticker = req.ticker.upper().strip()

    end_date   = datetime.today()
    start_date = end_date - timedelta(days=365 * req.lookback_years)
    start_str  = start_date.strftime("%Y-%m-%d")
    end_str    = end_date.strftime("%Y-%m-%d")

    # Fetch stock info for display name
    try:
        info = yf.Ticker(ticker).info
        company_name = info.get("longName") or info.get("shortName") or ticker
    except Exception:
        company_name = ticker

    # Build factor matrix (all series × all lags)
    try:
        factor_df = await asyncio.to_thread(
            build_factor_matrix, start_str, end_str, req.lag_weeks
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to build factor matrix: {e}")

    # Fetch stock returns
    try:
        stock_returns = await asyncio.to_thread(
            fetch_stock_returns, ticker, start_str, end_str
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    # Run LASSO
    try:
        model, scaler, feature_names, r2, r2_adj, y_pred, y_actual = await asyncio.to_thread(
            run_lasso, factor_df, stock_returns, req.top_n_factors
        )
    except Exception as e:
        raise HTTPException(500, f"Regression failed: {e}")

    # Extract non-zero coefficients
    coefs = dict(zip(feature_names, model.coef_))
    nonzero = {k: v for k, v in coefs.items() if abs(v) > 1e-8}

    # Sort by absolute magnitude
    sorted_factors = sorted(nonzero.items(), key=lambda x: abs(x[1]), reverse=True)
    top_factors    = sorted_factors[:req.top_n_factors]

    total_abs = sum(abs(v) for _, v in top_factors) or 1.0

    # Build lookup from series_id → (name, category)
    meta = {sid: (name, cat) for sid, name, cat in FRED_SERIES}

    factor_results = []
    for col_name, coef in top_factors:
        # col_name format: "SERIES_ID_lag{n}w"
        parts    = col_name.rsplit("_lag", 1)
        sid      = parts[0]
        lag_str  = parts[1].replace("w", "") if len(parts) > 1 else "1"
        lag_int  = int(lag_str)

        name, cat = meta.get(sid, (sid, "Other"))

        factor_results.append(FactorResult(
            series_id    = sid,
            name         = name,
            category     = cat,
            lag_weeks    = lag_int,
            coefficient  = round(coef, 6),
            direction    = "positive" if coef > 0 else "negative",
            importance_pct = round(100 * abs(coef) / total_abs, 1),
        ))

    # Predicted vs actual (downsample to last 104 weeks for payload size)
    combined = pd.DataFrame({"actual": y_actual, "predicted": y_pred}).dropna().tail(104)
    pva = [
        {
            "date":      d.strftime("%Y-%m-%d"),
            "actual":    round(float(a), 6),
            "predicted": round(float(p), 6),
        }
        for d, a, p in zip(combined.index, combined["actual"], combined["predicted"])
    ]

    model_note = (
        f"LASSO regression with TimeSeriesSplit CV (5 folds). "
        f"Tested lags: {req.lag_weeks} weeks. "
        f"Alpha selected: {model.alpha_:.5f}. "
        f"Non-zero factors before trimming: {len(nonzero)}."
    )

    return RegressionResponse(
        ticker              = ticker,
        company_name        = company_name,
        r2_score            = round(r2, 4),
        r2_adj              = round(r2_adj, 4),
        n_observations      = len(y_actual),
        factors             = factor_results,
        predicted_vs_actual = pva,
        model_note          = model_note,
    )