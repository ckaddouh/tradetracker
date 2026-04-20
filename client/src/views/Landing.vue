<template>
  <div class="landing">
    <div class="noise" aria-hidden="true"></div>

    <header class="topbar">
      <span class="logo">TradeTrackr</span>
      <div class="topbar-actions" v-if="!mode">
        <button class="btn-link" @click="mode = 'login'">Log in</button>
        <button class="btn-cta" @click="mode = 'register'">Get started →</button>
      </div>
    </header>

    <main class="hero" v-if="!mode">
      <div class="eyebrow">Paper trading · trade journaling · performance analytics</div>
      <h1 class="hero-title">
        Your edge starts<br/>
        <span class="accent-text">with the data.</span>
      </h1>
      <p class="hero-desc">
        Log your trade theses, track your positions, and measure conviction
        against outcomes — all in one place.
      </p>
      <button class="btn-hero" @click="mode = 'register'">Start for free →</button>

      <div class="deco-cards" aria-hidden="true">
        <div class="deco-card deco-card--1">
          <span class="dc-ticker">NVDA</span>
          <span class="dc-dir bullish">LONG</span>
          <span class="dc-pnl pos">+$1,284</span>
        </div>
        <div class="deco-card deco-card--2">
          <span class="dc-ticker">TSLA</span>
          <span class="dc-dir bearish">SHORT</span>
          <span class="dc-pnl neg">−$342</span>
        </div>
        <div class="deco-card deco-card--3">
          <span class="dc-label">Win rate</span>
          <span class="dc-big">67%</span>
        </div>
      </div>
    </main>

    <div class="auth-wrap" v-else>
      <div class="auth-card">
        <button class="back-link" @click="mode = null">← Back</button>
        <h2 class="auth-title">{{ mode === 'login' ? 'Welcome back' : 'Create account' }}</h2>
        <p class="auth-sub">{{ mode === 'login' ? 'Log in to your account' : 'Start tracking your trades today' }}</p>

        <div class="auth-tabs">
          <button :class="['tab', mode === 'register' && 'tab--active']" @click="mode = 'register'">Register</button>
          <button :class="['tab', mode === 'login' && 'tab--active']" @click="mode = 'login'">Login</button>
        </div>

        <form @submit.prevent="submit" class="auth-form">
          <div v-if="mode === 'register'" class="field">
            <label>Name</label>
            <input v-model="form.name" type="text" placeholder="Your name" required />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model="form.email" type="email" placeholder="you@example.com" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input v-model="form.password" type="password" placeholder="••••••••" required />
          </div>
          <p v-if="error" class="error-msg">{{ error }}</p>
          <button class="btn-submit" type="submit" :disabled="loading">
            {{ loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : 'Create account') }}
          </button>
        </form>
      </div>
    </div>

    <div class="tape" aria-hidden="true">
      <div class="tape-track">
        <span v-for="t in [...tickers, ...tickers]" :key="t.sym + t.val" class="tape-item">
          <span class="tape-sym">{{ t.sym }}</span>
          <span :class="t.up ? 'pos' : 'neg'">{{ t.up ? '+' : '' }}{{ t.val }}%</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

export default {
  name: 'Landing',
  setup() {
    const auth = useAuthStore()
    const router = useRouter()
    return { auth, router }
  },
  data() {
    return {
      mode: null,
      loading: false,
      error: null,
      form: { name: '', email: '', password: '' },
      tickers: [
        { sym: 'AAPL', val: '2.14', up: true },
        { sym: 'NVDA', val: '-1.08', up: false },
        { sym: 'TSLA', val: '5.32', up: true },
        { sym: 'MSFT', val: '0.87', up: true },
        { sym: 'META', val: '-0.45', up: false },
        { sym: 'AMZN', val: '1.22', up: true },
        { sym: 'GOOG', val: '-2.01', up: false },
        { sym: 'SPY',  val: '0.53', up: true },
        { sym: 'QQQ',  val: '0.91', up: true },
        { sym: 'BLK',  val: '1.67', up: true },
      ],
    }
  },
  methods: {
    async submit() {
      this.error = null
      this.loading = true
      try {
        if (this.mode === 'login') {
          await this.auth.login(this.form.email, this.form.password)
        } else {
          await this.auth.register(this.form.email, this.form.password, this.form.name)
        }
        this.router.push('/journal')
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.noise {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px;
}
.topbar {
  position: relative; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 48px;
  border-bottom: 1px solid var(--border);
}
.logo { font-weight: 800; font-size: 1rem; letter-spacing: -0.02em; color: var(--accent); }
.topbar-actions { display: flex; align-items: center; gap: 8px; }
.btn-link {
  background: none; border: none; color: var(--muted);
  font-family: var(--font-sans); font-size: 0.875rem; font-weight: 600;
  cursor: pointer; padding: 8px 16px; border-radius: var(--radius); transition: color 0.15s;
}
.btn-link:hover { color: var(--text); }
.btn-cta {
  background: var(--accent); color: #0f0f0f; border: none;
  font-family: var(--font-sans); font-size: 0.875rem; font-weight: 700;
  cursor: pointer; padding: 9px 18px; border-radius: var(--radius); transition: background 0.15s;
}
.btn-cta:hover { background: #d4f554; }

.hero {
  position: relative; z-index: 1; flex: 1;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  padding: 80px 48px 140px;
  max-width: 1100px; margin: 0 auto; width: 100%;
}
.eyebrow {
  font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent);
  text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 24px;
}
.hero-title {
  font-size: clamp(3rem, 7vw, 5.5rem); font-weight: 800;
  letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 24px; color: var(--text);
}
.accent-text { color: var(--accent); }
.hero-desc {
  color: var(--muted); font-size: 1.05rem; line-height: 1.65;
  max-width: 460px; margin-bottom: 40px;
}
.btn-hero {
  background: var(--text); color: var(--bg); border: none;
  font-family: var(--font-sans); font-size: 1rem; font-weight: 700;
  cursor: pointer; padding: 14px 28px; border-radius: var(--radius);
  transition: background 0.15s, transform 0.1s;
}
.btn-hero:hover { background: #fff; transform: translateY(-1px); }

.deco-cards {
  position: absolute; right: 48px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 14px;
}
.deco-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px 20px;
  display: flex; align-items: center; gap: 14px;
  animation: float 6s ease-in-out infinite; min-width: 210px;
}
.deco-card--1 { animation-delay: 0s; }
.deco-card--2 { animation-delay: 1.8s; }
.deco-card--3 { animation-delay: 3.4s; flex-direction: column; align-items: flex-start; gap: 4px; }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-10px); }
}
.dc-ticker { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 500; color: var(--text); }
.dc-dir { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.dc-dir.bullish { background: rgba(74,222,128,0.12); color: var(--bullish); }
.dc-dir.bearish { background: rgba(248,113,113,0.12); color: var(--bearish); }
.dc-pnl { font-family: var(--font-mono); font-size: 0.9rem; margin-left: auto; }
.dc-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.dc-big { font-family: var(--font-mono); font-size: 1.8rem; font-weight: 500; color: var(--accent); }
.pos { color: var(--bullish); font-family: var(--font-mono); }
.neg { color: var(--bearish); font-family: var(--font-mono); }

.auth-wrap {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 48px 24px 120px; position: relative; z-index: 1;
}
.auth-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 36px 32px;
  width: 100%; max-width: 420px;
  animation: fadeUp 0.28s ease;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.back-link {
  background: none; border: none; color: var(--muted);
  font-family: var(--font-sans); font-size: 0.8rem; cursor: pointer;
  padding: 0; margin-bottom: 24px; display: block; transition: color 0.15s;
}
.back-link:hover { color: var(--text); }
.auth-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 6px; }
.auth-sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 28px; }
.auth-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 28px; }
.tab {
  flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--muted); font-family: var(--font-sans); font-size: 0.875rem; font-weight: 600;
  cursor: pointer; padding: 10px; margin-bottom: -1px; transition: all 0.15s;
}
.tab--active { color: var(--text); border-bottom-color: var(--accent); }
.auth-form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 0.78rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; }
.field input {
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text); font-family: var(--font-sans); font-size: 0.9rem;
  padding: 11px 14px; width: 100%; transition: border-color 0.15s; outline: none;
}
.field input:focus { border-color: var(--accent); }
.error-msg {
  color: var(--bearish); font-size: 0.85rem;
  background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2);
  border-radius: var(--radius); padding: 10px 14px;
}
.btn-submit {
  width: 100%; background: var(--accent); color: #0f0f0f; border: none;
  border-radius: var(--radius); font-family: var(--font-sans); font-size: 0.9rem; font-weight: 700;
  padding: 12px; cursor: pointer; transition: background 0.15s; margin-top: 4px;
}
.btn-submit:hover:not(:disabled) { background: #d4f554; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.tape {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
  background: var(--surface); border-top: 1px solid var(--border);
  height: 36px; overflow: hidden; display: flex; align-items: center;
}
.tape-track {
  display: flex; animation: scroll 40s linear infinite; white-space: nowrap;
}
.tape-item { display: inline-flex; gap: 8px; padding: 0 28px; font-family: var(--font-mono); font-size: 0.72rem; align-items: center; }
.tape-sym { color: var(--muted); }
@keyframes scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@media (max-width: 768px) {
  .topbar { padding: 16px 20px; }
  .hero { padding: 48px 20px 100px; }
  .deco-cards { display: none; }
}
</style>