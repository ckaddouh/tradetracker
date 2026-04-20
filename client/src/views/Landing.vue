<template>
  <div class="landing">

    <!-- top bar -->
    <header class="lnav">
      <span class="lnav-brand">TradeTrackr</span>
      <div v-if="!mode" class="lnav-actions">
        <button class="btn btn-ghost" @click="mode='login'">Log in</button>
        <button class="btn btn-primary" @click="mode='register'">Get started</button>
      </div>
    </header>

    <!-- hero -->
    <main v-if="!mode" class="hero">
      <p class="hero-eyebrow">Paper trading · Trade journaling · P&amp;L analytics</p>
      <h1 class="hero-h1">Track every thesis.<br><span class="accent">Measure every outcome.</span></h1>
      <p class="hero-body">Log trade ideas, set conviction levels, and see whether your edge is real — all in a clean, data-first journal.</p>
      <div class="hero-btns">
        <button class="btn btn-primary hero-cta" @click="mode='register'">Create free account</button>
        <button class="btn btn-ghost" @click="mode='login'">Sign in</button>
      </div>

      <!-- mock data cards -->
      <div class="cards" aria-hidden="true">
        <div class="mock-card">
          <div class="mc-row">
            <span class="mc-ticker">NVDA</span>
            <span class="mc-tag mc-bull">LONG</span>
          </div>
          <div class="mc-title">AI capex cycle underpriced</div>
          <div class="mc-pnl pos">+$1,284.50</div>
        </div>
        <div class="mock-card mock-card--dim">
          <div class="mc-row">
            <span class="mc-ticker">TSLA</span>
            <span class="mc-tag mc-bear">SHORT</span>
          </div>
          <div class="mc-title">Margins compressing on EV price war</div>
          <div class="mc-pnl neg">−$342.00</div>
        </div>
        <div class="mock-stat-card">
          <div class="msc-label">Win rate</div>
          <div class="msc-val">67%</div>
          <div class="msc-sub">12 closed trades</div>
        </div>
      </div>
    </main>

    <!-- auth form -->
    <div v-else class="auth-shell">
      <div class="auth-box">
        <button class="auth-back" @click="mode=null">← Back</button>
        <h2 class="auth-title">{{ mode === 'login' ? 'Welcome back' : 'Create account' }}</h2>

        <div class="auth-tabs">
          <button :class="['atab', mode==='register' && 'atab--on']" @click="mode='register'">Register</button>
          <button :class="['atab', mode==='login'    && 'atab--on']" @click="mode='login'">Log in</button>
        </div>

        <form @submit.prevent="submit" class="auth-form">
          <div v-if="mode==='register'" class="form-group">
            <label>Name</label>
            <input v-model="form.name" type="text" placeholder="Your name" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="form.email" type="email" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="form.password" type="password" placeholder="••••••••" required />
          </div>
          <p v-if="error" class="form-error">{{ error }}</p>
          <button class="btn btn-primary auth-submit" type="submit" :disabled="loading">
            {{ loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : 'Create account') }}
          </button>
        </form>
      </div>
    </div>

    <!-- ticker tape -->
    <div class="tape" aria-hidden="true">
      <div class="tape-inner">
        <span v-for="t in tape" :key="t.s+t.v" class="tape-item">
          <span class="tape-sym">{{ t.s }}</span>
          <span :class="t.up ? 'pos' : 'neg'">{{ t.up ? '+' : '' }}{{ t.v }}%</span>
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
    return { auth: useAuthStore(), router: useRouter() }
  },
  data() {
    return {
      mode: null, loading: false, error: null,
      form: { name: '', email: '', password: '' },
      tape: [
        {s:'AAPL',v:'2.14',up:true},{s:'NVDA',v:'-1.08',up:false},
        {s:'TSLA',v:'5.32',up:true},{s:'MSFT',v:'0.87',up:true},
        {s:'META',v:'-0.45',up:false},{s:'AMZN',v:'1.22',up:true},
        {s:'GOOG',v:'-2.01',up:false},{s:'SPY',v:'0.53',up:true},
        {s:'QQQ',v:'0.91',up:true},{s:'BLK',v:'1.67',up:true},
        {s:'AAPL',v:'2.14',up:true},{s:'NVDA',v:'-1.08',up:false},
        {s:'TSLA',v:'5.32',up:true},{s:'MSFT',v:'0.87',up:true},
        {s:'META',v:'-0.45',up:false},{s:'AMZN',v:'1.22',up:true},
      ],
    }
  },
  methods: {
    async submit() {
      this.error = null; this.loading = true
      try {
        if (this.mode === 'login') await this.auth.login(this.form.email, this.form.password)
        else await this.auth.register(this.form.email, this.form.password, this.form.name)
        this.router.push('/journal')
      } catch(e) { this.error = e.message }
      finally { this.loading = false }
    },
  },
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

/* nav */
.lnav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--page-pad);
  height: 56px;
  border-bottom: 1px solid var(--border);
  max-width: 100%;
}
.lnav-brand { font-family: var(--mono); font-size: 0.82rem; color: var(--accent); letter-spacing: 0.02em; }
.lnav-actions { display: flex; gap: 8px; align-items: center; }

/* hero */
.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 72px var(--page-pad) 100px;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}
.hero-eyebrow {
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
}
.hero-h1 {
  font-size: clamp(2rem, 5vw, 3.4rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin-bottom: 20px;
}
.accent { color: var(--accent); }
.hero-body {
  color: var(--muted2);
  font-size: 1rem;
  line-height: 1.65;
  max-width: 460px;
  margin-bottom: 32px;
}
.hero-btns { display: flex; gap: 10px; margin-bottom: 56px; flex-wrap: wrap; justify-content: center; }
.hero-cta { padding: 10px 22px; font-size: 0.9rem; }

/* mock cards */
.cards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.mock-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  animation: floatA 5s ease-in-out infinite;
}
.mock-card--dim { animation-name: floatB; animation-delay: 1.2s; opacity: 0.75; }
.mock-stat-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  animation: floatC 5s ease-in-out infinite;
  animation-delay: 2.4s;
}
@keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes floatC { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
.mc-row { display: flex; align-items: center; gap: 8px; }
.mc-ticker { font-family: var(--mono); font-size: 0.88rem; font-weight: 500; }
.mc-tag { font-family: var(--mono); font-size: 0.62rem; font-weight: 600; padding: 2px 7px; border-radius: 3px; text-transform: uppercase; }
.mc-bull { background: rgba(61,220,132,0.12); color: var(--green); }
.mc-bear { background: rgba(255,107,107,0.12); color: var(--red); }
.mc-title { font-size: 0.78rem; color: var(--muted2); line-height: 1.4; }
.mc-pnl { font-family: var(--mono); font-size: 0.9rem; font-weight: 500; margin-top: 2px; }
.msc-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.msc-val { font-family: var(--mono); font-size: 1.9rem; font-weight: 400; color: var(--accent); line-height: 1.1; }
.msc-sub { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); }

.pos { color: var(--green); font-family: var(--mono); }
.neg { color: var(--red);   font-family: var(--mono); }

/* auth */
.auth-shell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px var(--page-pad) 100px;
}
.auth-box {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r-lg);
  padding: 28px 24px;
  width: 100%;
  max-width: 380px;
  animation: fadeUp 0.22s ease;
}
@keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.auth-back {
  background: none; border: none; color: var(--muted); font-family: var(--sans);
  font-size: 0.78rem; cursor: pointer; padding: 0; margin-bottom: 18px; display: block;
  transition: color 0.12s;
}
.auth-back:hover { color: var(--text); }
.auth-title { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 18px; }
.auth-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.atab {
  flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--muted); font-family: var(--sans); font-size: 0.82rem; font-weight: 600;
  cursor: pointer; padding: 8px; margin-bottom: -1px; transition: all 0.12s;
}
.atab--on { color: var(--text); border-bottom-color: var(--accent); }
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-submit { width: 100%; margin-top: 4px; padding: 10px; }

/* tape */
.tape {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  height: 34px; background: var(--surface); border-top: 1px solid var(--border);
  overflow: hidden; display: flex; align-items: center;
}
.tape-inner {
  display: flex; white-space: nowrap;
  animation: scroll 35s linear infinite;
}
.tape-item { display: inline-flex; gap: 7px; padding: 0 22px; font-family: var(--mono); font-size: 0.7rem; align-items: center; }
.tape-sym { color: var(--muted); }
@keyframes scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
</style>