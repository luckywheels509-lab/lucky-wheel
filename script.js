/* ═══════════════════════════════════════════
   LUCKY WHEEL — script.js
════════════════════════════════════════════ */

const WORKER_URL = 'https://rough-lake-9ff1.luckywheels509.workers.dev/';


/* ─── Tawk.to Widget Configuration ────────────── */
window.Tawk_API = window.Tawk_API || {};
window.Tawk_API.onLoad = function() {
  // Position widget to bottom-right with offset to avoid contact bar
  window.Tawk_API.customStyle = {
    zIndex: 999999,
    position: 'br', // bottom-right
    bottom: '80px', // offset to avoid contact bar
    right: '20px',
    left: 'auto',
    top: 'auto'
  };
};

/* ─── Load contact links from Worker config ── */
fetch(WORKER_URL + '/config')
  .then(r => r.json())
  .then(cfg => {
    document.querySelectorAll('[data-social]').forEach(el => {
      const key = el.dataset.social;
      if (cfg[key]) el.href = cfg[key];
    });
  })
  .catch(() => {});

/* ─── Navbar scroll ────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

/* ─── Mobile hamburger ─────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* ─── Hero particles ───────────────────────── */
(function spawnParticles() {
  const container = document.getElementById('particles');
  const colors = ['#8b5cf6','#ec4899','#06b6d4','#f59e0b','#10b981'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${Math.random()*15+10}s;
      animation-delay:${Math.random()*10}s;
      filter:blur(${Math.random()*1}px);
    `;
    container.appendChild(p);
  }
})();

/* ═══════════════════════════════════════════
   SPIN WHEEL
════════════════════════════════════════════ */
const canvas  = document.getElementById('spinCanvas');
const ctx     = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultEl= document.getElementById('spinResult');
const segNameEl = document.getElementById('resultSegment');

/* 12 segments: 1-10 + FREE SPIN + JACKPOT
   Probabilities: JACKPOT=2% (15pts), 1-6=80% (÷6 each), 7-10+FREE=18% (÷5 each) */
const segments = [
  { label:'1',       display:'1 PTS',     icon:'🍋', color:'#7c3aed', text:'#fff',    freespin:false, jackpot:false, pts:1  },
  { label:'2',       display:'2 PTS',     icon:'💵', color:'#0e7490', text:'#fff',    freespin:false, jackpot:false, pts:2  },
  { label:'FREE',    display:'FREE SPIN', icon:'🎁', color:'#065f46', text:'#fff',    freespin:true,  jackpot:false, pts:0  },
  { label:'3',       display:'3 PTS',     icon:'🎯', color:'#be185d', text:'#fff',    freespin:false, jackpot:false, pts:3  },
  { label:'4',       display:'4 PTS',     icon:'⭐', color:'#92400e', text:'#fff',    freespin:false, jackpot:false, pts:4  },
  { label:'5',       display:'5 PTS',     icon:'🎲', color:'#1e3a5f', text:'#fff',    freespin:false, jackpot:false, pts:5  },
  { label:'JACKPOT', display:'JACKPOT',   icon:'🎰', color:'#78350f', text:'#ffd700', freespin:false, jackpot:true,  pts:15 },
  { label:'6',       display:'6 PTS',     icon:'💎', color:'#4c1d95', text:'#fff',    freespin:false, jackpot:false, pts:6  },
  { label:'7',       display:'7 PTS',     icon:'🏆', color:'#7c2d12', text:'#ffd700', freespin:false, jackpot:false, pts:7  },
  { label:'8',       display:'8 PTS',     icon:'💰', color:'#0f4c3a', text:'#fff',    freespin:false, jackpot:false, pts:8  },
  { label:'9',       display:'9 PTS',     icon:'🎪', color:'#312e81', text:'#fff',    freespin:false, jackpot:false, pts:9  },
  { label:'10',      display:'10 PTS',    icon:'🔥', color:'#831843', text:'#fff',    freespin:false, jackpot:false, pts:10 },
];

const NUM   = segments.length;
const ARC   = (2 * Math.PI) / NUM;
let CX, CY, R;

let currentAngle    = 0;
let spinning        = false;
let spinCooldown    = false;
let lastSpinResult  = null;
let lastSpinId      = null;
let lastSpinTime    = null;
let currentPlayer   = null;
let visitorIP       = null;
let soundMuted      = localStorage.getItem('lucky_wheel_muted') === '1';
let winSegmentIndex = -1;
let winGlowPhase    = 0;
let glowRAF         = null;
let spinProgress    = 0; // 0-1 for motion-blur label fade

/* ─── Color helpers for 3D slice gradient ─── */
function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function lightenColor(hex, amt) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darkenColor(hex, amt) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}

/* ─── Responsive HiDPI canvas sizing ─── */
function resizeCanvas() {
  const wrap = canvas.parentElement;
  const cssSize = Math.min(wrap.clientWidth || 380, 420);
  const size = Math.max(220, cssSize);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width  = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  CX = size / 2;
  CY = size / 2;
  R  = CX - 20; /* leave room for LED ring */
  drawWheel(currentAngle);
}
window.addEventListener('resize', () => resizeCanvas());

/* ─── Web Audio: tick synced with rotation ─── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
/* Per-segment tick pitches — variety per color */
const TICK_FREQS = [1200,900,1350,800,1100,700,1500,1000,1250,1050];

function playTickForSegment(segIdx, intensity) {
  if (soundMuted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const baseFreq = TICK_FREQS[segIdx % TICK_FREQS.length];
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(baseFreq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, ac.currentTime + 0.045);
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16 * intensity, ac.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.065);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.075);
  if (navigator.vibrate) try { navigator.vibrate(6); } catch(e) {}
  /* pointer flex */
  const ptr = document.querySelector('.wheel-pointer');
  if (ptr) { ptr.classList.remove('pointer-flex'); void ptr.offsetWidth; ptr.classList.add('pointer-flex'); }
}

function playWinChime() {
  if (soundMuted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    const t = ac.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.5);
  });
}

function playJackpotChime() {
  if (soundMuted) return;
  const ac = getAudioCtx();
  if (!ac) return;
  [330, 415, 523, 659, 830, 1047].forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    const t = ac.currentTime + i * 0.13;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.9);
  });
}

/* Fetch visitor IP for Telegram notification only */
fetch('https://api.ipify.org?format=json')
  .then(r => r.json())
  .then(d => { visitorIP = d.ip; })
  .catch(() => { visitorIP = 'unknown'; });

function drawWheel(angle) {
  if (CX === undefined) return;
  ctx.clearRect(0, 0, CX * 2, CY * 2);
  const diam = CX * 2;
  const fSize = diam < 300 ? 11 : diam < 360 ? 13 : 15;

  /* ── 1. Slices with 3D radial gradient + win highlight ── */
  segments.forEach((seg, i) => {
    const start = angle + i * ARC;
    const end   = start + ARC;
    const mid   = start + ARC / 2;
    const midX  = CX + Math.cos(mid) * R * 0.6;
    const midY  = CY + Math.sin(mid) * R * 0.6;

    /* 3D gradient: brighter toward outer rim */
    const grad = ctx.createRadialGradient(midX, midY, 0, CX, CY, R);
    grad.addColorStop(0,   lightenColor(seg.color, 55));
    grad.addColorStop(0.5, seg.color);
    grad.addColorStop(1,   darkenColor(seg.color, 35));

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    /* win highlight: dim all others */
    if (winSegmentIndex >= 0 && i !== winSegmentIndex) {
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R, start, end);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fill();
    }
    /* winning slice: gold pulse glow */
    if (winSegmentIndex === i) {
      const gAlpha = 0.25 + Math.sin(winGlowPhase) * 0.2;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R, start, end);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,215,0,${gAlpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,215,0,${0.6 + Math.sin(winGlowPhase) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    /* ── labels: fade at high speed (motion blur effect) ── */
    const labelAlpha = spinning ? Math.min(1, (1 - spinProgress) * 1.5) : 1;
    ctx.save();
    ctx.globalAlpha = labelAlpha;
    ctx.translate(CX, CY);
    ctx.rotate(mid);
    ctx.textAlign   = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur  = 5;
    /* icon emoji */
    ctx.font      = `${fSize + 1}px serif`;
    ctx.fillStyle = seg.text;
    ctx.fillText(seg.icon, R - 30, -6);
    /* prize display */
    ctx.font      = `bold ${fSize}px Poppins, sans-serif`;
    ctx.fillStyle = seg.text;
    ctx.fillText(seg.display, R - 10, 8);
    ctx.restore();
  });

  /* ── 2. Metallic outer ring ── */
  const ringGrad = ctx.createLinearGradient(CX - R, CY, CX + R, CY);
  ringGrad.addColorStop(0,    '#3a3a5a');
  ringGrad.addColorStop(0.25, '#c8c8d8');
  ringGrad.addColorStop(0.5,  '#ffffff');
  ringGrad.addColorStop(0.75, '#b0b0c8');
  ringGrad.addColorStop(1,    '#3a3a5a');
  ctx.beginPath();
  ctx.arc(CX, CY, R + 2, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth   = 7;
  ctx.stroke();

  /* ── 3. LED bulbs ── */
  const ledR    = R + 13;
  const numLEDs = 24;
  const now     = Date.now();
  for (let i = 0; i < numLEDs; i++) {
    const a   = angle * 1.5 + (i / numLEDs) * Math.PI * 2;
    const x   = CX + Math.cos(a) * ledR;
    const y   = CY + Math.sin(a) * ledR;
    const lit = winSegmentIndex >= 0
      ? (Math.floor(now / 120) + i) % 3 === 0
      : spinning
        ? (Math.floor(now / 60)  + i) % 3 === 0
        : i % 4 === 0;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    if (lit) {
      const ledColor = winSegmentIndex >= 0 ? '#ffd700' : '#ffe066';
      ctx.fillStyle  = ledColor;
      ctx.shadowColor = ledColor;
      ctx.shadowBlur  = 10;
    } else {
      ctx.fillStyle  = '#1e1e38';
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ── 4. Screws / rivets at fixed angles ── */
  for (let i = 0; i < 8; i++) {
    const a  = (i / 8) * Math.PI * 2;
    const sx = CX + Math.cos(a) * (R + 2);
    const sy = CY + Math.sin(a) * (R + 2);
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    const sg = ctx.createRadialGradient(sx - 1.5, sy - 1.5, 0, sx, sy, 5);
    sg.addColorStop(0, '#ddd'); sg.addColorStop(1, '#555');
    ctx.fillStyle  = sg;
    ctx.shadowBlur = 0;
    ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8; ctx.stroke();
    /* cross */
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy);
    ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3);
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke();
  }

  /* ── 5. Center cap (glossy) ── */
  const capR  = Math.max(28, R * 0.22);
  const capGr = ctx.createRadialGradient(CX - capR * 0.35, CY - capR * 0.35, 0, CX, CY, capR);
  capGr.addColorStop(0, '#2a2a5a');
  capGr.addColorStop(0.6, '#0d0d28');
  capGr.addColorStop(1, '#050510');
  ctx.beginPath();
  ctx.arc(CX, CY, capR, 0, Math.PI * 2);
  ctx.fillStyle = capGr;
  ctx.fill();
  ctx.strokeStyle = 'rgba(139,92,246,0.6)';
  ctx.lineWidth   = 2;
  ctx.stroke();
  /* gloss shine on cap */
  const shine = ctx.createRadialGradient(CX - capR * 0.4, CY - capR * 0.4, 0, CX, CY, capR);
  shine.addColorStop(0,   'rgba(255,255,255,0.18)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(CX, CY, capR, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();
}

resizeCanvas();

/* Suspense ease: fast start, almost stops at 80%, then crawls to end */
function easeOutSuspense(t) {
  if (t < 0.75) {
    const s = t / 0.75;
    return (1 - Math.pow(1 - s, 3)) * 0.88;
  }
  const s = (t - 0.75) / 0.25;
  /* cubic smooth-step for last 12% — agonisingly slow */
  return 0.88 + s * s * (3 - 2 * s) * 0.12;
}

/* Weighted picker:
   3,4,5,6           = 21.6% each (86.4% total)
   1,2,7,8,9,10,FREE = 1.8%  each (12.6% total)
   JACKPOT           = 1% */
function pickWeightedSegment() {
  const topLabels = ['3','4','5','6'];
  const weights = segments.map(s => {
    if (s.jackpot)                   return 1;
    if (topLabels.includes(s.label)) return 21.6;
    return 1.8;
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return segments.length - 1;
}

function spin() {
  if (spinning || spinCooldown) return;
  spinning     = true;
  winSegmentIndex = -1;
  spinProgress    = 0;
  resultEl.classList.remove('visible');
  getAudioCtx();

  const targetIndex = pickWeightedSegment();
  const extraSpins  = 5 + Math.floor(Math.random() * 4);

  /* Near-miss: 30% chance of overshooting by ~0.7 segments then snapping back */
  const nearMiss   = Math.random() < 0.3;
  const baseOffset = (Math.random() * 0.5 - 0.25) * ARC;
  const overshoot  = nearMiss ? ARC * 0.75 : 0;
  const normTarget = targetIndex * ARC + ARC / 2 + baseOffset;
  const landAngle  = ((-(normTarget + currentAngle + Math.PI / 2)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const totalAngle = extraSpins * 2 * Math.PI + landAngle + overshoot;
  const snapBack   = overshoot; /* how much to retract in second phase */

  const duration   = 4500 + Math.random() * 1500;
  let startTime    = null;
  const startAngle = currentAngle;
  let lastSegment  = -1;
  let snapPhase    = false;
  let snapStart    = null;
  const snapDur    = 420;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed  = ts - startTime;
    let   progress = Math.min(elapsed / duration, 1);
    spinProgress   = progress;

    if (!snapPhase) {
      const eased  = easeOutSuspense(progress);
      currentAngle = startAngle + totalAngle * eased;
      drawWheel(currentAngle);

      const norm   = ((-(currentAngle + Math.PI / 2)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const segIdx = Math.floor(norm / ARC) % NUM;
      if (segIdx !== lastSegment) {
        lastSegment = segIdx;
        playTickForSegment(segIdx, 0.35 + (1 - progress) * 0.65);
      }

      if (progress < 1) { requestAnimationFrame(frame); return; }

      /* Near-miss snap-back phase */
      if (nearMiss && snapBack > 0) {
        snapPhase = true; snapStart = null;
        requestAnimationFrame(frame); return;
      }
    } else {
      /* Snap-back: ease into reverse */
      if (!snapStart) snapStart = ts;
      const sp = Math.min((ts - snapStart) / snapDur, 1);
      const se = sp * sp * (3 - 2 * sp);
      currentAngle = (startAngle + totalAngle) - snapBack * se;
      drawWheel(currentAngle);
      if (sp < 1) { requestAnimationFrame(frame); return; }
    }

    spinning = false;
    spinCooldown = true;
    showResult();
    setSpinLocked(true);
    canvas.style.cursor   = 'default';
  }
  requestAnimationFrame(frame);
}

function showResult() {
  const normalized = ((-(currentAngle + Math.PI / 2)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const index      = Math.floor(normalized / ARC) % NUM;
  const seg        = segments[index];
  lastSpinResult   = seg.display;
  lastSpinId       = 'SP-' + Date.now().toString(36).toUpperCase();
  lastSpinTime     = new Date();

  /* flip-card reveal */
  winSegmentIndex = index;
  segNameEl.textContent = seg.display;
  resultEl.classList.remove('visible');
  void resultEl.offsetWidth;
  resultEl.classList.add('visible');

  /* sounds */
  if (seg.jackpot || seg.freespin) playJackpotChime();
  else                             playWinChime();
  if (navigator.vibrate) try { navigator.vibrate([40, 60, 40, 60, 120]); } catch(e) {}
  launchConfetti();
  startWinGlow();

  /* streak + history */
  if (currentPlayer) {
    const streak = updateStreak(currentPlayer);
    renderStreak(streak);
  }
  addSpinHistory(seg.display);

  /* result subtext */
  const subEl = document.getElementById('resultSubtext');
  if (subEl) {
    if (seg.jackpot)       subEl.innerHTML = '🏆 <b>JACKPOT! 15 points awarded!</b> Contact admin immediately to claim your prize!';
    else if (seg.freespin) subEl.innerHTML = '🎁 <b>Free Spin granted!</b> Message us on Facebook to redeem.';
    else                   subEl.innerHTML = `🎯 <b>${seg.pts} point${seg.pts !== 1 ? 's' : ''} awarded!</b> Check our socials for your bonus code.`;
  }

  /* fire live winner notification */
  fireWinnerNotif(currentPlayer || 'Player', seg);

  sendSpinToTelegram(lastSpinResult, currentPlayer, lastSpinId, lastSpinTime);
}

/* ─── Win glow animation loop ─── */
function startWinGlow() {
  if (glowRAF) cancelAnimationFrame(glowRAF);
  const start = Date.now();
  function loop() {
    winGlowPhase = (Date.now() - start) / 300;
    drawWheel(currentAngle);
    if (Date.now() - start < 6000) glowRAF = requestAnimationFrame(loop);
    else { winSegmentIndex = -1; drawWheel(currentAngle); }
  }
  glowRAF = requestAnimationFrame(loop);
}

/* ─── Streak tracker ─── */
function updateStreak(username) {
  const key      = 'streak_' + username.toLowerCase();
  const lastKey  = 'streak_last_' + username.toLowerCase();
  const today    = new Date().toDateString();
  const lastDay  = localStorage.getItem(lastKey);
  let   streak   = parseInt(localStorage.getItem(key) || '0', 10);
  if (lastDay === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  streak = lastDay === yesterday ? streak + 1 : 1;
  localStorage.setItem(key, streak);
  localStorage.setItem(lastKey, today);
  return streak;
}
function renderStreak(streak) {
  let el = document.getElementById('streakBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'streakBadge';
    el.className = 'streak-badge';
    const wrapper = document.querySelector('.wheel-wrapper');
    wrapper.insertBefore(el, wrapper.firstChild);
  }
  el.innerHTML = `<i class="fa-solid fa-fire"></i> ${streak}-day streak!`;
  el.classList.add('visible');
}

/* ─── Spin history strip ─── */
function addSpinHistory(display) {
  let hist = JSON.parse(localStorage.getItem('spin_history') || '[]');
  hist.unshift(display);
  if (hist.length > 5) hist = hist.slice(0, 5);
  localStorage.setItem('spin_history', JSON.stringify(hist));
  renderSpinHistory(hist);
}
function renderSpinHistory(hist) {
  let strip = document.getElementById('spinHistory');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'spinHistory';
    strip.className = 'spin-history-strip';
    document.querySelector('.wheel-wrapper').appendChild(strip);
  }
  strip.innerHTML = `<span class="sh-label"><i class="fa-solid fa-clock-rotate-left"></i> Last spins:</span>`
    + hist.map((r, i) => `<span class="sh-badge" style="opacity:${1 - i * 0.15}">${r}</span>`).join('');
}

/* Init history on load */
(function initHistory() {
  const hist = JSON.parse(localStorage.getItem('spin_history') || '[]');
  if (hist.length) renderSpinHistory(hist);
})();

/* ═══════════════════════════════════════════
   FLOWING WINNER NOTIFICATIONS
════════════════════════════════════════════ */
const US_FIRST = [
  'James','John','Robert','Michael','William','David','Richard','Joseph','Charles','Thomas',
  'Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua',
  'Kenneth','Kevin','Brian','George','Timothy','Ronald','Edward','Jason','Jeffrey','Ryan',
  'Jacob','Gary','Nicholas','Eric','Jonathan','Stephen','Larry','Justin','Scott','Brandon',
  'Benjamin','Samuel','Raymond','Gregory','Frank','Alexander','Patrick','Jack','Dennis','Jerry',
  'Mary','Patricia','Jennifer','Linda','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen',
  'Lisa','Nancy','Betty','Margaret','Sandra','Ashley','Dorothy','Kimberly','Emily','Donna',
  'Michelle','Carol','Amanda','Melissa','Deborah','Stephanie','Rebecca','Sharon','Laura','Cynthia',
  'Kathleen','Amy','Angela','Shirley','Anna','Brenda','Pamela','Emma','Nicole','Helen',
  'Samantha','Katherine','Christine','Debra','Rachel','Carolyn','Janet','Catherine','Maria','Heather',
];
const US_LAST = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
  'Turner','Phillips','Evans','Collins','Edwards','Stewart','Morris','Murphy','Cook','Rogers',
  'Morgan','Peterson','Cooper','Reed','Bailey','Bell','Gomez','Kelly','Howard','Ward',
  'Cox','Diaz','Richardson','Wood','Watson','Brooks','Bennett','Gray','James','Reyes',
  'Cruz','Hughes','Price','Myers','Long','Foster','Sanders','Ross','Morales','Powell',
  'Sullivan','Russell','Ortiz','Jenkins','Gutierrez','Perry','Butler','Barnes','Fisher','Henderson',
];
/* ── namefake.com name pool ── */
const namePool = [];
function localRandomName() {
  const first = US_FIRST[Math.floor(Math.random() * US_FIRST.length)];
  const last  = US_LAST [Math.floor(Math.random() * US_LAST.length)];
  return first + ' ' + last[0] + '***';
}
function maskName(full) {
  const parts = (full || '').trim().split(' ');
  const first = parts[0] || 'Player';
  const last  = parts[1] || '';
  return first + (last ? ' ' + last[0] + '***' : '***');
}
function refillNamePool() {
  const BATCH = 15;
  const calls = Array.from({ length: BATCH }, () =>
    fetch('https://api.namefake.com/english-united-states')
      .then(r => r.json())
      .then(d => { if (d && d.name) namePool.push(maskName(d.name)); })
      .catch(() => namePool.push(localRandomName()))
  );
  Promise.all(calls);
}
refillNamePool(); /* prefetch on load */

function randomUSName() {
  if (namePool.length < 5) refillNamePool();
  return namePool.length ? namePool.splice(Math.floor(Math.random() * namePool.length), 1)[0]
                         : localRandomName();
}
const FAKE_PRIZES = [
  { display:'8 PTS',    icon:'💰',  jackpot: false },
  { display:'9 PTS',    icon:'🎪',  jackpot: false },
  { display:'10 PTS',   icon:'🔥',  jackpot: false },
  { display:'8 PTS',    icon:'💰',  jackpot: false },
  { display:'9 PTS',    icon:'🎪',  jackpot: false },
  { display:'10 PTS',   icon:'🔥',  jackpot: false },
  { display:'FREE SPIN', icon:'🎁', jackpot: false },
  { display:'15 PTS',   icon:'🏆',  jackpot: true },
];

function getWinnerFeed() {
  let feed = document.getElementById('winnerFeed');
  if (!feed) {
    feed = document.createElement('div');
    feed.id = 'winnerFeed';
    feed.className = 'winner-feed';
    document.body.appendChild(feed);
  }
  return feed;
}

function fireWinnerNotif(playerName, seg) {
  const icon  = seg.jackpot ? '🎰' : seg.freespin ? '🎁' : seg.icon;
  const label = seg.jackpot ? 'JACKPOT!' : seg.freespin ? 'FREE SPIN!' : seg.display;
  const color = seg.jackpot ? 'notif-jackpot' : seg.freespin ? 'notif-free' : 'notif-normal';
  pushNotif(playerName, icon, label, color);
}

function pushNotif(name, icon, label, cls) {
  const feed = getWinnerFeed();
  const el   = document.createElement('div');
  el.className = `winner-notif ${cls || ''}`;
  el.innerHTML =
    `<span class="wn-icon">${icon}</span>` +
    `<span class="wn-text"><b>${name}</b> just won <b>${label}</b></span>` +
    `<span class="wn-time">just now</span>`;
  feed.prepend(el);

  /* cap at 5 visible */
  const all = feed.querySelectorAll('.winner-notif');
  if (all.length > 5) all[all.length - 1].remove();

  /* auto-remove after 6s */
  setTimeout(() => { el.classList.add('wn-exit'); setTimeout(() => el.remove(), 500); }, 6000);
}

/* Simulated winners stream — fires random notifs periodically */
(function startFakeWinners() {
  function fire() {
    const name  = randomUSName();
    const prize = FAKE_PRIZES[Math.floor(Math.random() * FAKE_PRIZES.length)];
    const isJackpot = prize.jackpot === true;
    const isFree    = prize.display === 'FREE SPIN';
    pushNotif(
      name,
      prize.icon,
      isJackpot ? 'JACKPOT! 15 PTS' : isFree ? 'FREE SPIN!' : prize.display,
      isJackpot ? 'notif-jackpot' : isFree ? 'notif-free' : 'notif-normal'
    );
    /* next fire: 8–22 seconds */
    setTimeout(fire, 8000 + Math.random() * 14000);
  }
  setTimeout(fire, 4000); /* first fake winner after 4s */
})();

/* ─── Confetti burst (canvas-free, DOM particles) ─── */
function launchConfetti() {
  const colors = ['#8b5cf6','#ec4899','#06b6d4','#f59e0b','#10b981','#fff'];
  const wrap = document.querySelector('.wheel-wrapper');
  if (!wrap) return;
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('span');
    c.className = 'confetti-piece';
    c.style.cssText = `
      position:absolute; left:50%; top:40%;
      width:${6 + Math.random() * 6}px; height:${8 + Math.random() * 6}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:2px; pointer-events:none; z-index:50;
      transform:translate(-50%, -50%) rotate(${Math.random() * 360}deg);
      --tx:${(Math.random() - 0.5) * 600}px;
      --ty:${-200 - Math.random() * 200}px;
      --rot:${(Math.random() - 0.5) * 720}deg;
      animation: confettiBurst ${1.4 + Math.random() * 0.8}s ease-out forwards;
    `;
    wrap.appendChild(c);
    setTimeout(() => c.remove(), 2400);
  }
}

/* ═══════════════════════════════════════════
   TELEGRAM BOT NOTIFICATION
════════════════════════════════════════════ */

function sendSpinToTelegram(result, username, spinId, spinTime) {
  const now      = spinTime || new Date();
  const dateStr  = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  const timeStr  = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const expiry   = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiryStr = expiry.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
                  + ' ' + expiry.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  const text =
    `🎰 *New Spin Result*\n` +
    `━━━━━━━━━━━━━━━━\n` +

console.log('Sending to Telegram...', { text });
fetch(WORKER_URL, {
method:  'POST',
headers: { 'Content-Type': 'application/json' },
body:    JSON.stringify({ text })
})
.then(res => {
if (!res.ok) console.error('Telegram Worker Error:', res.status, res.statusText);
else console.log('Telegram Notification Sent!');
})
.catch(err => console.error('Telegram Fetch Failed:', err));
}

const SPIN_COOLDOWN_MS = 2 * 60 * 60 * 1000; /* 2 hours */

function getPlayerCooldown(username) {
  const key  = 'spin_user_' + username.toLowerCase();
  const last = parseInt(localStorage.getItem(key) || '0', 10);
  const diff = Date.now() - last;
  return diff < SPIN_COOLDOWN_MS ? SPIN_COOLDOWN_MS - diff : 0;
}

function setPlayerSpinTime(username) {
  localStorage.setItem('spin_user_' + username.toLowerCase(), Date.now());
}

/* ── Inline username bar setup ── */
const spinUsernameInput = document.getElementById('spinUsernameInput');
const spinUsernameBtn   = document.getElementById('spinUsernameBtn');
const spinMsg           = document.getElementById('spinMsg');

let countdownTimer = null;

const SPIN_MSG_STYLES = {
  error:   'background:rgba(239,68,68,0.15);border:1.5px solid rgba(239,68,68,0.4);color:#fca5a5;',
  success: 'background:rgba(16,185,129,0.15);border:1.5px solid rgba(16,185,129,0.4);color:#6ee7b7;',
  info:    'background:rgba(139,92,246,0.15);border:1.5px solid rgba(139,92,246,0.4);color:#c4b5fd;',
};
function setSpinMsg(type, html) {
  spinMsg.style.cssText =
    `display:block;padding:14px 18px;border-radius:10px;font-size:0.95rem;` +
    `font-weight:500;text-align:center;line-height:1.6;` +
    `max-width:440px;margin:0 auto 16px;` +
    (SPIN_MSG_STYLES[type] || '');
  spinMsg.innerHTML = html;
}

function startCountdown(username) {
  if (countdownTimer) clearInterval(countdownTimer);
  function update() {
    const wait = getPlayerCooldown(username);
    if (wait <= 0) {
      clearInterval(countdownTimer);
      setSpinMsg('success', `✅ You are logged in as <b>${username}</b>. Your spin is now available!`);
      setSpinLocked(false);
      return;
    }
    const totalSec = Math.ceil(wait / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const timeStr = (h > 0 ? `${h}h ` : '') + (m > 0 ? `${m}m ` : '') + `${s}s`;
    setSpinMsg('error',
      `🔐 You are logged in as <b>${username}</b><br>` +
      `⏳ Already spun today. Next spin in: <b style="font-size:1.1em">${timeStr}</b>`);
  }
  update();
  countdownTimer = setInterval(update, 1000);
}

function confirmUsername() {
  const name = spinUsernameInput.value.trim();
  if (!name) { spinUsernameInput.focus(); return; }
  currentPlayer = name;
  spinUsernameInput.disabled = true;
  spinUsernameBtn.disabled   = true;
  spinUsernameBtn.innerHTML  = '<i class="fa-solid fa-check"></i>';
  spinUsernameBtn.style.background = '#10b981';
  spinUsernameBtn.style.boxShadow  = '0 4px 14px rgba(16,185,129,0.45)';
  const wait = getPlayerCooldown(name);
  if (wait > 0) {
    startCountdown(name);
    return; /* keep spin button locked */
  }
  setSpinMsg('info', `👋 You are logged in as <b>${name}</b>. Good luck!`);
  /* Unlock spin button only if allowed */
  setSpinLocked(false);
  /* Scroll to the below spin button */
  const below = document.getElementById('spinBelowBtn');
  if (below) setTimeout(() => below.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
}

spinUsernameBtn.addEventListener('click', confirmUsername);
spinUsernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmUsername(); });

function askUsernameAndSpin() {
  if (spinCooldown || spinBtn.disabled) return;
  if (currentPlayer) { startSpinIfAllowed(currentPlayer); return; }
  spinUsernameInput.focus();
  showToast('Please enter your username first!');
}

function startSpinIfAllowed(username) {
  const wait = getPlayerCooldown(username);
  if (wait > 0) {
    startCountdown(username);
    setSpinLocked(true);
    return;
  }
  setPlayerSpinTime(username);
  spin();
}

/* Spin locked until username confirmed */
const spinBelowBtn = document.getElementById('spinBelowBtn');
function setSpinLocked(locked) {
  spinBtn.disabled       = locked;
  spinBtn.style.opacity  = locked ? '0.4' : '';
  spinBtn.style.cursor   = locked ? 'not-allowed' : '';
  if (spinBelowBtn) spinBelowBtn.disabled = locked;
}
setSpinLocked(true);

spinBtn.addEventListener('click', askUsernameAndSpin);
canvas.addEventListener('click', askUsernameAndSpin);

/* ─── Drag-to-spin (#6) ─── */
let dragActive = false, dragLastAngle = 0, dragVel = 0, dragLastTime = 0;

function getEventAngle(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return Math.atan2(cy - rect.top - CY, cx - rect.left - CX);
}

canvas.addEventListener('mousedown',  startDrag, { passive: false });
canvas.addEventListener('touchstart', startDrag, { passive: false });
document.addEventListener('mousemove',  onDrag,   { passive: false });
document.addEventListener('touchmove',  onDrag,   { passive: false });
document.addEventListener('mouseup',   endDrag);
document.addEventListener('touchend',  endDrag);

function startDrag(e) {
  if (spinning || spinCooldown || spinBtn.disabled) return;
  e.preventDefault();
  dragActive    = true;
  dragLastAngle = getEventAngle(e);
  dragVel       = 0;
  dragLastTime  = Date.now();
}
function onDrag(e) {
  if (!dragActive) return;
  e.preventDefault();
  const a     = getEventAngle(e);
  let   delta = a - dragLastAngle;
  /* normalise to [-π, π] */
  if (delta >  Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  const now = Date.now();
  dragVel       = delta / Math.max(1, now - dragLastTime);
  dragLastAngle = a;
  dragLastTime  = now;
  currentAngle += delta;
  drawWheel(currentAngle);
}
function endDrag() {
  if (!dragActive) return;
  dragActive = false;
  const speed = Math.abs(dragVel);
  if (speed > 0.003 && !spinBtn.disabled) {
    if (!currentPlayer) { spinUsernameInput.focus(); showToast('Enter your username first!'); return; }
    const wait = getPlayerCooldown(currentPlayer);
    if (wait > 0) { startCountdown(currentPlayer); return; }
    setPlayerSpinTime(currentPlayer);
    spin();
  }
}

/* ─── Mute toggle ─── */
(function injectMuteToggle() {
  const wrap = document.querySelector('.wheel-container');
  if (!wrap) return;
  const btn = document.createElement('button');
  btn.className = 'wheel-mute-btn';
  btn.setAttribute('aria-label', 'Toggle sound');
  btn.title = 'Toggle sound';
  const render = () => {
    btn.innerHTML = `<i class="fa-solid ${soundMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>`;
  };
  render();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    soundMuted = !soundMuted;
    localStorage.setItem('lucky_wheel_muted', soundMuted ? '1' : '0');
    render();
    if (!soundMuted) playTick(0.6);
  });
  wrap.appendChild(btn);
})();


/* ═══════════════════════════════════════════
   TERMS ACCORDION
════════════════════════════════════════════ */
const termsToggle = document.getElementById('termsToggle');
const termsBody   = document.getElementById('termsBody');

termsToggle.addEventListener('click', () => {
  const open = termsBody.classList.toggle('open');
  termsToggle.classList.toggle('open', open);
});

document.querySelectorAll('.ta-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.ta-item');
    const body = item.querySelector('.ta-body');
    const wasOpen = item.classList.contains('open');
    /* close all */
    document.querySelectorAll('.ta-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.ta-body').classList.remove('open');
    });
    /* re-open if it wasn't already */
    if (!wasOpen) {
      item.classList.add('open');
      body.classList.add('open');
    }
  });
});

/* ═══════════════════════════════════════════
   USERNAME MODAL
════════════════════════════════════════════ */
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const usernameForm  = document.getElementById('usernameForm');
const usernameInput = document.getElementById('usernameInput');

document.getElementById('getReceiptBtn').addEventListener('click', () => {
  usernameInput.value = currentPlayer || '';
  modalOverlay.classList.add('open');
  setTimeout(() => usernameInput.focus(), 300);
});


function closeModal() { modalOverlay.classList.remove('open'); }
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

usernameForm.addEventListener('submit', e => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;
  closeModal();
  generateReceipt(username);
});

/* ═══════════════════════════════════════════
   RECEIPT GENERATOR  (canvas → PNG download)
   Rendered as an image so it cannot be
   copy-pasted or edited as text.
════════════════════════════════════════════ */
function generateReceipt(username) {
  const W = 560, H = 820;
  const rc = document.getElementById('receiptCanvas');
  rc.width  = W;
  rc.height = H;
  const cx = rc.getContext('2d');

  /* ── background ── */
  const bg = cx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#0a0a1f');
  bg.addColorStop(0.5, '#100820');
  bg.addColorStop(1,   '#0a0a1f');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, W, H);

  /* ── grid overlay ── */
  cx.strokeStyle = 'rgba(139,92,246,0.07)';
  cx.lineWidth   = 1;
  for (let x = 0; x < W; x += 32) { cx.beginPath(); cx.moveTo(x,0); cx.lineTo(x,H); cx.stroke(); }
  for (let y = 0; y < H; y += 32) { cx.beginPath(); cx.moveTo(0,y); cx.lineTo(W,y); cx.stroke(); }

  /* ── diagonal watermark text (repeated) ── */
  cx.save();
  cx.globalAlpha = 0.045;
  cx.fillStyle   = '#8b5cf6';
  cx.font        = 'bold 22px Poppins, sans-serif';
  cx.translate(W/2, H/2);
  cx.rotate(-Math.PI / 5);
  const wm = 'LUCKY WHEEL  ';
  for (let row = -6; row <= 6; row++) {
    for (let col = -4; col <= 4; col++) {
      cx.fillText(wm, col * 220 - 110, row * 60);
    }
  }
  cx.restore();

  /* ── border ── */
  roundRect(cx, 20, 20, W-40, H-40, 20);
  cx.strokeStyle = 'rgba(139,92,246,0.45)';
  cx.lineWidth   = 1.5;
  cx.stroke();

  /* ── top glow strip ── */
  const glow = cx.createLinearGradient(0, 20, W, 20);
  glow.addColorStop(0,   'rgba(139,92,246,0)');
  glow.addColorStop(0.5, 'rgba(139,92,246,0.35)');
  glow.addColorStop(1,   'rgba(139,92,246,0)');
  cx.fillStyle = glow;
  cx.fillRect(20, 20, W-40, 3);

  /* ── logo icon placeholder ── */
  cx.save();
  cx.fillStyle = 'rgba(139,92,246,0.15)';
  circle(cx, W/2, 100, 44);
  cx.fill();
  cx.strokeStyle = 'rgba(139,92,246,0.5)';
  cx.lineWidth   = 1.5;
  cx.stroke();
  cx.fillStyle   = '#a78bfa';
  cx.font        = '36px "Font Awesome 6 Free"';
  cx.textAlign   = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('\uf655', W/2, 101); /* dharmachakra wheel unicode */
  cx.restore();

  /* ── brand name ── */
  cx.textAlign   = 'center';
  cx.textBaseline = 'alphabetic';
  cx.fillStyle   = '#f1f5f9';
  cx.font        = 'bold 28px Poppins, sans-serif';
  cx.fillText('Lucky Wheel', W/2, 170);

  cx.fillStyle = 'rgba(139,92,246,0.85)';
  cx.font      = '13px Poppins, sans-serif';
  cx.fillText('OFFICIAL SPIN RECEIPT', W/2, 192);

  /* ── divider ── */
  dashedLine(cx, 54, 212, W-54, 212, 'rgba(139,92,246,0.3)');

  /* ── receipt ID + timestamp ── */
  const receiptId = lastSpinId || ('LW-' + Date.now().toString(36).toUpperCase());
  const now       = lastSpinTime || new Date();
  const dateStr   = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  const timeStr   = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  cx.fillStyle = '#475569';
  cx.font      = '12px Poppins, sans-serif';
  cx.textAlign = 'left';
  cx.fillText('Receipt ID', 54, 242);
  cx.textAlign = 'right';
  cx.fillText(receiptId, W-54, 242);

  cx.textAlign = 'left';
  cx.fillText('Date', 54, 264);
  cx.textAlign = 'right';
  cx.fillText(dateStr, W-54, 264);

  cx.textAlign = 'left';
  cx.fillText('Time', 54, 286);
  cx.textAlign = 'right';
  cx.fillText(timeStr, W-54, 286);

  /* ── divider ── */
  dashedLine(cx, 54, 306, W-54, 306, 'rgba(139,92,246,0.3)');

  /* ── player ── */
  cx.fillStyle   = '#94a3b8';
  cx.font        = '13px Poppins, sans-serif';
  cx.textAlign   = 'center';
  cx.fillText('PLAYER', W/2, 336);

  cx.fillStyle   = '#f1f5f9';
  cx.font        = 'bold 26px Poppins, sans-serif';
  cx.fillText(username, W/2, 366);

  /* ── divider ── */
  dashedLine(cx, 54, 388, W-54, 388, 'rgba(139,92,246,0.3)');

  /* ── result card ── */
  const segNum = segNameEl.textContent || '?';

  cx.fillStyle   = '#94a3b8';
  cx.font        = '13px Poppins, sans-serif';
  cx.textAlign   = 'center';
  cx.fillText('SPIN RESULT', W/2, 418);

  /* number circle */
  const grad = cx.createRadialGradient(W/2, 490, 10, W/2, 490, 72);
  grad.addColorStop(0, '#7c3aed');
  grad.addColorStop(1, '#4c1d95');
  cx.fillStyle = grad;
  circle(cx, W/2, 490, 72);
  cx.fill();
  cx.strokeStyle = 'rgba(139,92,246,0.7)';
  cx.lineWidth   = 2;
  cx.stroke();

  /* glow ring */
  cx.save();
  cx.globalAlpha = 0.18;
  cx.fillStyle   = '#8b5cf6';
  circle(cx, W/2, 490, 90);
  cx.fill();
  cx.restore();

  cx.fillStyle    = '#fff';
  cx.font         = `bold ${segNum.length > 1 ? 54 : 62}px Poppins, sans-serif`;
  cx.textAlign    = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(segNum, W/2, 492);
  cx.textBaseline = 'alphabetic';

  /* ── message ── */
  cx.fillStyle = '#94a3b8';
  cx.font      = '13px Poppins, sans-serif';
  cx.textAlign = 'center';
  cx.fillText('Check our socials for your bonus code!', W/2, 592);

  /* ── divider ── */
  dashedLine(cx, 54, 616, W-54, 616, 'rgba(139,92,246,0.3)');

  /* ── bottom note ── */
  cx.fillStyle = '#334155';
  cx.font      = '11px Poppins, sans-serif';
  cx.textAlign = 'center';
  cx.fillText('This receipt is for entertainment purposes only.', W/2, 644);
  cx.fillText('© 2026 Lucky Wheel · play responsibly · 18+', W/2, 662);

  /* ── barcode-style deco ── */
  drawBarcode(cx, W/2 - 90, 688, 180, 36);

  cx.fillStyle = '#1e293b';
  cx.font      = '10px Poppins, sans-serif';
  cx.textAlign = 'center';
  cx.fillText(receiptId, W/2, 742);

  /* ── bottom glow strip ── */
  const glow2 = cx.createLinearGradient(0, H-23, W, H-23);
  glow2.addColorStop(0,   'rgba(236,72,153,0)');
  glow2.addColorStop(0.5, 'rgba(236,72,153,0.3)');
  glow2.addColorStop(1,   'rgba(236,72,153,0)');
  cx.fillStyle = glow2;
  cx.fillRect(20, H-23, W-40, 3);

  /* ── download ── */
  const link = document.createElement('a');
  link.download = `LuckyWheel_Receipt_${username}_${receiptId}.png`;
  link.href     = rc.toDataURL('image/png');
  link.click();

  showToast('<i class="fa-solid fa-circle-check"></i> Receipt downloaded!');
}

/* ── canvas helpers ── */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

function dashedLine(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h) {
  const bars = 42;
  const bw   = w / bars;
  ctx.save();
  for (let i = 0; i < bars; i++) {
    const thick  = (i % 3 === 0);
    const height = thick ? h : h * (0.55 + Math.random() * 0.35);
    ctx.fillStyle = `rgba(139,92,246,${thick ? 0.55 : 0.25})`;
    ctx.fillRect(x + i * bw, y + (h - height), bw * (thick ? 1.6 : 0.9), height);
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════
   GAMES DATA
════════════════════════════════════════════ */
const allGames = [
  { title:'Yolo',          playerLink:'https://yolo777.game/',                           image:'images/yolo.png',         badge:'live' },
  { title:'Blue Dragon',   playerLink:'https://app.bluedragon777.com/',                   image:'images/bluedragon.jpg',   badge:'hot'  },
  { title:'Juwa',          playerLink:'https://dl.juwa777.com/',                         image:'images/juwa.jpg',         badge:'hot'  },
  { title:'Juwa 2.0',      playerLink:'https://m.juwa2.com/',                            image:'images/juwa2.jpg',        badge:'hot'  },
  { title:'VegasSweep',    playerLink:'https://m.lasvegassweeps.com/',                    image:'images/vegassweep.jpg',   badge:'live' },
  { title:'GameVault',     playerLink:'https://download.gamevault999.com/',              image:'images/gamevault.jpg',    badge:'hot'  },
  { title:'Orion Stars',   playerLink:'https://start.orionstars.vip:8580/index.html',     image:'images/orionstars.jpg',   badge:'live' },
  { title:'River Sweeps',  playerLink:'https://bet777.eu/',                              image:'images/riversweeps.png',  badge:'hot'  },
  { title:'MilkyWay',      playerLink:'https://milkywayapp.xyz/',                        image:'images/milkyway.jpg',     badge:'new'  },
  { title:'Medusa',        playerLink:'https://medusa777.com/',                          image:'images/medusa.jpg',       badge:'hot'  },
  { title:'Cash Machine',  playerLink:'https://www.cashmachine777.com/',                 image:'images/cashmachine.png',  badge:'live' },
  { title:'Casino Ignite', playerLink:'https://download.casinoignitee.vip/',             image:'images/casinoignite.png', badge:'hot'  },
  { title:'Game Room',     playerLink:'https://www.gameroom777.com/',                    image:'images/gameroom.png',     badge:'live' },
  { title:'Firekirin',     playerLink:'http://start.firekirin.xyz:8580/',                          image:'images/firekirin.jpg',    badge:'hot'  },
  { title:'Pandamaster',   playerLink:'https://pandamaster.vip:8888/index.html',         image:'images/pandamaster.jpg',  badge:'new'  },
];

function badgeClass(b) {
  return b === 'hot' ? 'badge-hot' : b === 'new' ? 'badge-new' : 'badge-live';
}
function badgeLabel(b) {
  return b === 'hot' ? 'Hot' : b === 'new' ? 'New' : 'Live';
}

function renderGames() {
  const grid = document.getElementById('gamesGrid');
  grid.innerHTML = '';

  allGames.forEach((g, i) => {
    const card = document.createElement('a');
    card.className = 'game-chip';
    card.href      = g.playerLink;
    card.target    = '_blank';
    card.rel       = 'noopener noreferrer';
    card.title     = g.title;
    card.style.animationDelay = `${i * 30}ms`;
    card.innerHTML = `
      <div class="chip-img-wrap">
        <img src="${g.image}" alt="${g.title}" loading="lazy" />
        <span class="chip-badge ${badgeClass(g.badge)}">${badgeLabel(g.badge)}</span>
      </div>
      <span class="chip-name">${g.title}</span>
    `;
    grid.appendChild(card);
  });

  /* fade-in via CSS animation (no observer needed) */
  grid.querySelectorAll('.game-chip').forEach(el => {
    el.style.animation = `chipFadeIn 0.4s ease both`;
  });
}

/* ═══════════════════════════════════════════
   INTERSECTION OBSERVER
════════════════════════════════════════════ */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.social-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease, border-color 0.25s, box-shadow 0.25s';
  observer.observe(el);
});

renderGames();

document.getElementById('newsletterForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = e.target.querySelector('input[type="email"]').value.trim();
  if (!email) return;
  
  e.target.reset();
  showToast('<i class="fa-solid fa-circle-check"></i> Subscribed! Bonus codes incoming.');
  
  // Send newsletter subscription to Telegram
  sendNewsletterToTelegram(email);
});

/* ═══════════════════════════════════════════
   TOAST UTILITY
════════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   NEWSLETTER TELEGRAM NOTIFICATION
════════════════════════════════════════════ */
function sendNewsletterToTelegram(email) {
  console.log('📧 Sending newsletter subscription for:', email);
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  const text =
    `📧 *New Newsletter Subscription*\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📩 *Email:* ${email}\n` +
    `📅 *Date:* ${dateStr} ${timeStr}\n` +
    `🌐 *Site:* Lucky Wheel\n` +
    `📡 *IP:* \`${visitorIP || 'unknown'}\`\n` +
    `━━━━━━━━━━━━━━━━`;

  console.log('📤 Sending to worker:', WORKER_URL);
  
  fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text })
  })
  .then(response => {
    console.log('✅ Newsletter response:', response.status);
    if (!response.ok) {
      console.error('❌ Newsletter failed:', response.statusText);
    }
  })
  .catch(error => {
    console.error('❌ Newsletter error:', error);
  });
}

/* ═══════════════════════════════════════════
   TOAST UTILITY
════════════════════════════════════════════ */
function showToast(html) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

