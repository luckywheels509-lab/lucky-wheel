/* ═══════════════════════════════════════════
   LUCKY WHEEL — script.js
════════════════════════════════════════════ */

const WORKER_URL = 'https://rough-lake-9ff1.luckywheels509.workers.dev';

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

const segments = [
  { label: '1',  color: '#7c3aed', text: '#fff' },
  { label: '2',  color: '#0e7490', text: '#fff' },
  { label: '3',  color: '#be185d', text: '#fff' },
  { label: '4',  color: '#065f46', text: '#fff' },
  { label: '5',  color: '#92400e', text: '#fff' },
  { label: '6',  color: '#7c2d12', text: '#fff' },
  { label: '7',  color: '#1e3a5f', text: '#fff' },
  { label: '8',  color: '#4c1d95', text: '#fff' },
  { label: '9',  color: '#0f4c3a', text: '#fff' },
  { label: '10', color: '#78350f', text: '#fff' },
];

const NUM   = segments.length;
const ARC   = (2 * Math.PI) / NUM;
const CX    = canvas.width / 2;
const CY    = canvas.height / 2;
const R     = CX - 6;

let currentAngle   = 0;
let spinning       = false;
let spinCooldown   = false;
let lastSpinResult = null;
let lastSpinId     = null;
let lastSpinTime   = null;
let currentPlayer  = null;
let visitorIP      = null;

/* Fetch visitor IP for Telegram notification only */
fetch('https://api.ipify.org?format=json')
  .then(r => r.json())
  .then(d => { visitorIP = d.ip; })
  .catch(() => { visitorIP = 'unknown'; });

function drawWheel(angle) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  segments.forEach((seg, i) => {
    const start = angle + i * ARC;
    const end   = start + ARC;
    const mid   = start + ARC / 2;

    /* slice */
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, start, end);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    /* subtle border */
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    /* label */
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(mid);
    ctx.textAlign    = 'right';
    ctx.fillStyle    = seg.text;
    ctx.font         = `bold ${canvas.width < 340 ? 14 : 18}px Poppins, sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 4;
    ctx.fillText(seg.label, R - 16, 5);
    ctx.restore();
  });

  /* center cap shadow */
  ctx.beginPath();
  ctx.arc(CX, CY, 38, 0, 2 * Math.PI);
  ctx.fillStyle = '#050510';
  ctx.fill();
}

drawWheel(currentAngle);

function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

/* Weighted segment picker: 80% chance of landing on 1-7 */
function pickWeightedSegment() {
  const weights = segments.map((seg, i) => i < 7 ? 80 / 7 : 20 / 3);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

function spin() {
  if (spinning || spinCooldown) return;
  spinning = true;
  resultEl.classList.remove('visible');

  const targetIndex = pickWeightedSegment();
  const extraSpins  = 5 + Math.floor(Math.random() * 4);
  const offset      = (Math.random() - 0.5) * ARC * 0.6;
  const normTarget  = targetIndex * ARC + ARC / 2 + offset;
  const landAngle   = ((-(normTarget + currentAngle + Math.PI / 2)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const totalAngle  = extraSpins * 2 * Math.PI + landAngle;
  const duration    = 4000 + Math.random() * 1500;
  let startTime     = null;
  const startAngle  = currentAngle;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed  = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOut(progress);

    currentAngle = startAngle + totalAngle * eased;
    drawWheel(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      spinning = false;
      spinCooldown = true;
      showResult();
      /* Lock the spin button permanently after result */
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.4';
      spinBtn.style.cursor  = 'not-allowed';
      canvas.style.cursor   = 'default';
    }
  }
  requestAnimationFrame(frame);
}

function showResult() {
  /* pointer is at the top (−π/2 from canvas 0).
     Normalise current angle so we can find which slice is under pointer. */
  const normalized = ((-(currentAngle + Math.PI / 2)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const index = Math.floor(normalized / ARC) % NUM;
  lastSpinResult = segments[index].label;
  lastSpinId     = 'SP-' + Date.now().toString(36).toUpperCase();
  lastSpinTime   = new Date();
  segNameEl.textContent = lastSpinResult;
  resultEl.classList.add('visible');
  sendSpinToTelegram(lastSpinResult, currentPlayer, lastSpinId, lastSpinTime);
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
    `👤 *Player:* ${username}\n` +
    `🏆 *Result:* ${result}\n` +
    `🆔 *Receipt ID:* \`${spinId}\`\n` +
    `📅 *Spin Time:* ${dateStr} ${timeStr}\n` +
    `⏳ *Expires:* ${expiryStr}\n` +
    `🌐 *Site:* Lucky Wheel\n` +
    `📡 *IP:* \`${visitorIP || 'unknown'}\`\n` +
    `━━━━━━━━━━━━━━━━`;

  fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text })
  }).catch(() => {});
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
      spinBtn.disabled      = false;
      spinBtn.style.opacity = '';
      spinBtn.style.cursor  = '';
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
  spinUsernameBtn.innerHTML  = '<i class="fa-solid fa-circle-check"></i> ' + name;
  const wait = getPlayerCooldown(name);
  if (wait > 0) {
    startCountdown(name);
    return; /* keep spin button locked */
  }
  setSpinMsg('info', `👋 You are logged in as <b>${name}</b>. Good luck!`);
  /* Unlock spin button only if allowed */
  spinBtn.disabled      = false;
  spinBtn.style.opacity = '';
  spinBtn.style.cursor  = '';
  setPlayerSpinTime(name);
  spin();
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
    spinBtn.disabled      = true;
    spinBtn.style.opacity = '0.4';
    spinBtn.style.cursor  = 'not-allowed';
    return;
  }
  setPlayerSpinTime(username);
  spin();
}

/* Spin locked until username confirmed */
spinBtn.disabled = true;
spinBtn.style.opacity = '0.4';
spinBtn.style.cursor  = 'not-allowed';

spinBtn.addEventListener('click', askUsernameAndSpin);
canvas.addEventListener('click', askUsernameAndSpin);


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
  cx.fillText('\uf6cf', W/2, 101); /* dice-d20 unicode */
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
  { title:'Firekirin',     playerLink:'https://firekirin.com/',                          image:'images/firekirin.jpg',    badge:'hot'  },
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

  fetch(WORKER_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text })
  }).catch(() => {});
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


