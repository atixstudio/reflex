/* ============================================================
   REFLEX — Режимы: БЛИЦ | ВЫЖИВАНИЕ | ДЕЙЛИК | УМНЫЕ БУСТЕРЫ
   ============================================================ */
'use strict';

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const TELEGRAM_APP_URL = 'https://t.me/YourBotName/reflex';
const DAILY_TASKS = [
  // 0 - Воскресенье
  { id: 0, text: 'НАБЕРИ 100 В БЛИЦЕ', mode: 'blitz', kind: 'score', need: 100, reward: 500, check: G => G.mode === 'blitz' && G.score >= 100 },
  // 1 - Понедельник
  { id: 1, text: 'НАБЕРИ 50 В БЛИЦЕ', mode: 'blitz', kind: 'score', need: 50, reward: 200, check: G => G.mode === 'blitz' && G.score >= 50 },
  // 2 - Вторник
  { id: 2, text: 'ВЫЖИВИ 30 СЕКУНД', mode: 'survival', kind: 'time', need: 30, reward: 200, check: G => G.mode === 'survival' && G.timeLeft >= 30 },
  // 3 - Среда
  { id: 3, text: 'ВЫБЕЙ КОМБО x3', mode: 'blitz', kind: 'combo', need: 3, reward: 250, check: G => G.maxMultiplier >= 3 },
  // 4 - Четверг
  { id: 4, text: 'НАБЕРИ 75 В БЛИЦЕ', mode: 'blitz', kind: 'score', need: 75, reward: 300, check: G => G.mode === 'blitz' && G.score >= 75 },
  // 5 - Пятница
  { id: 5, text: 'ВЫЖИВИ 45 СЕКУНД', mode: 'survival', kind: 'time', need: 45, reward: 350, check: G => G.mode === 'survival' && G.timeLeft >= 45 },
  // 6 - Суббота
  { id: 6, text: 'ВЫБЕЙ КОМБО x5', mode: 'blitz', kind: 'combo', need: 5, reward: 400, check: G => G.maxMultiplier >= 5 }
];

function getTodayTask() {
  const day = new Date().getDay(); // 0..6
  return DAILY_TASKS[day];
}

if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
      tg.setHeaderColor('#0F0F1E');
      tg.setBackgroundColor('#0F0F1E');
    }
  } catch (e) {}
}

/* ---------- ХРАНИЛИЩЕ ---------- */
const Store = {
  getBestBlitz()    { return parseInt(localStorage.getItem('reflex_best_blitz') || '0', 10); },
  setBestBlitz(v)   { localStorage.setItem('reflex_best_blitz', String(v)); this.cloudSave('reflex_best_blitz', String(v)); },
  getBestSurvival() { return parseInt(localStorage.getItem('reflex_best_survival') || '0', 10); },
  setBestSurvival(v){ localStorage.setItem('reflex_best_survival', String(v)); this.cloudSave('reflex_best_survival', String(v)); },
  getCoins()        { return parseInt(localStorage.getItem('reflex_coins') || '0', 10); },
  addCoins(n)       {
    const v = this.getCoins() + n;
    localStorage.setItem('reflex_coins', String(v));
    this.cloudSave('reflex_coins', String(v));
    if (n > 0) {
      const s = this.getAchStats();
      s.earned = (s.earned || 0) + n;
      this.setAchStats(s);
    }
  },
  getSkins()        { try { return JSON.parse(localStorage.getItem('reflex_skins') || 'null'); } catch(e) { return null; } },
  setSkins(v)       { const s = JSON.stringify(v); localStorage.setItem('reflex_skins', s); this.cloudSave('reflex_skins', s); },
  getEquipped()     { return localStorage.getItem('reflex_skin') || 'neon'; },
  setEquipped(id)   { localStorage.setItem('reflex_skin', id); this.cloudSave('reflex_skin', id); },
  getSound()        { return localStorage.getItem('reflex_sound') !== 'off'; },
  setSound(on)      { localStorage.setItem('reflex_sound', on ? 'on' : 'off'); },
  getMusic()        { return localStorage.getItem('reflex_music') !== 'off'; },
  setMusic(on)      { localStorage.setItem('reflex_music', on ? 'on' : 'off'); },
  getHaptic()       { return localStorage.getItem('reflex_haptic') !== 'off'; },
  setHaptic(on)     { localStorage.setItem('reflex_haptic', on ? 'on' : 'off'); },
  getDailyDone()    { return localStorage.getItem('reflex_daily_done_date') === todayStr(); },
  setDailyDone()    { localStorage.setItem('reflex_daily_done_date', todayStr()); },
  getBoosters()     {
    try { return JSON.parse(localStorage.getItem('reflex_boosters') || '{}') || {}; }
    catch(e) { return {}; }
  },
  setBoosters(obj)  {
    const s = JSON.stringify(obj);
    localStorage.setItem('reflex_boosters', s);
    this.cloudSave('reflex_boosters', s);
  },
  addBooster(id, n) {
    const b = this.getBoosters();
    b[id] = (b[id] || 0) + n;
    this.setBoosters(b);
  },
  useBooster(id) {
    const b = this.getBoosters();
    if (!b[id] || b[id] <= 0) return false;
    b[id]--;
    if (b[id] <= 0) delete b[id];
    this.setBoosters(b);
    const stats = this.getAchStats();
    stats.boostersUsed = (stats.boostersUsed || 0) + 1;
    this.setAchStats(stats);
    return true;
  },
  getRuns() {
    try {
      const list = JSON.parse(localStorage.getItem('reflex_runs') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  },
  addRun(run) {
    const list = this.getRuns();
    list.unshift(run);
    localStorage.setItem('reflex_runs', JSON.stringify(list.slice(0, 30)));
  },
  getAchStats() {
    try {
      const raw = JSON.parse(localStorage.getItem('reflex_ach') || 'null');
      if (raw && typeof raw === 'object') {
        return Object.assign({
          played: 0, playedBlitz: false, playedSurvival: false,
          bestCombo: 0, bestLevel: 1, dailies: 0, earned: 0,
          cleanBlitz: false, boostersUsed: 0
        }, raw);
      }
    } catch (e) {}
    return {
      played: 0, playedBlitz: false, playedSurvival: false,
      bestCombo: 0, bestLevel: 1, dailies: 0, earned: 0,
      cleanBlitz: false, boostersUsed: 0
    };
  },
  setAchStats(v) { localStorage.setItem('reflex_ach', JSON.stringify(v)); },
  getUnlocked() {
    try {
      const list = JSON.parse(localStorage.getItem('reflex_ach_done') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  },
  setUnlocked(list) { localStorage.setItem('reflex_ach_done', JSON.stringify(list)); },
  cloudSave(key, val) {
    if (tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
      try { tg.CloudStorage.setItem(key, String(val)); } catch (e) {}
    }
  },
  reset() {
    ['reflex_best_blitz', 'reflex_best_survival', 'reflex_coins', 'reflex_skins', 'reflex_skin',
     'reflex_boosters', 'reflex_sound', 'reflex_haptic', 'reflex_daily_done_date', 'reflex_onboarded',
     'reflex_runs', 'reflex_ach', 'reflex_ach_done', 'reflex_ach_unseen'].forEach(k => {
      localStorage.removeItem(k);
      if (tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
        try { tg.CloudStorage.removeItem(k); } catch(e) {}
      }
    });
  }
};

const ACHIEVEMENTS = [
  { id: 'first', name: 'ПЕРВЫЙ РАУНД', desc: 'Заверши любой раунд', reward: 25, check: s => s.played >= 1 },
  { id: 'both', name: 'ОБА РЕЖИМА', desc: 'Сыграй Блиц и Выживание', reward: 30, check: s => s.playedBlitz && s.playedSurvival },
  { id: 'blitz50', name: 'БЛИЦ 50', desc: 'Набери 50 очков в Блице', reward: 40, check: () => Store.getBestBlitz() >= 50 },
  { id: 'blitz100', name: 'БЛИЦ 100', desc: 'Набери 100 очков в Блице', reward: 80, check: () => Store.getBestBlitz() >= 100 },
  { id: 'blitz200', name: 'БЛИЦ 200', desc: 'Набери 200 очков в Блице', reward: 150, check: () => Store.getBestBlitz() >= 200 },
  { id: 'surv30', name: '30 СЕКУНД', desc: 'Продержись 30 секунд в Выживании', reward: 40, check: () => Store.getBestSurvival() >= 30 },
  { id: 'surv60', name: 'МИНУТА', desc: 'Продержись 60 секунд в Выживании', reward: 120, check: () => Store.getBestSurvival() >= 60 },
  { id: 'combo10', name: 'СЕРИЯ 10', desc: 'Собери комбо 10 за один раунд', reward: 40, check: s => s.bestCombo >= 10 },
  { id: 'combo20', name: 'В ОГНЕ', desc: 'Собери комбо 20 за один раунд', reward: 100, check: s => s.bestCombo >= 20 },
  { id: 'level5', name: 'УРОВЕНЬ 5', desc: 'Дойди до 5 уровня за раунд', reward: 80, check: s => s.bestLevel >= 5 },
  { id: 'clean', name: 'ЧИСТЫЙ БЛИЦ', desc: 'Блиц без промахов и пропусков, от 25 попаданий', reward: 120, check: s => s.cleanBlitz },
  { id: 'rounds10', name: 'ДЕСЯТЬ РАУНДОВ', desc: 'Сыграй 10 раундов', reward: 50, check: s => s.played >= 10 },
  { id: 'boost5', name: 'С ПОМОЩЬЮ', desc: 'Используй бустеры 5 раз', reward: 40, check: s => s.boostersUsed >= 5 },
  { id: 'palette', name: 'НОВАЯ ПАЛИТРА', desc: 'Купи вторую палитру', reward: 40, check: () => (Store.getSkins() || []).length > 1 },
  { id: 'daily3', name: 'ТРИ ДНЯ', desc: 'Выполни 3 задания дня', reward: 100, check: s => s.dailies >= 3 },
  { id: 'earn500', name: 'КОПИЛКА', desc: 'Заработай 500 монет', reward: 50, check: s => s.earned >= 500 }
];

function migrateAchStats() {
  if (localStorage.getItem('reflex_ach')) return;
  const runs = Store.getRuns();
  Store.setAchStats({
    played: runs.length,
    playedBlitz: runs.some(r => r.mode === 'blitz') || Store.getBestBlitz() > 0,
    playedSurvival: runs.some(r => r.mode === 'survival') || Store.getBestSurvival() > 0,
    bestCombo: runs.reduce((m, r) => Math.max(m, r.combo || 0), 0),
    bestLevel: runs.reduce((m, r) => Math.max(m, r.level || 1), 1),
    dailies: 0,
    earned: Math.max(0, Store.getCoins()),
    cleanBlitz: false,
    boostersUsed: 0
  });
}

function noteRunStats() {
  const s = Store.getAchStats();
  s.played = (s.played || 0) + 1;
  if (G.mode === 'blitz') s.playedBlitz = true;
  else s.playedSurvival = true;
  s.bestCombo = Math.max(s.bestCombo || 0, G.maxCombo || 0);
  s.bestLevel = Math.max(s.bestLevel || 1, G.level || 1);
  if (G.mode === 'blitz' && G.wrongs === 0 && G.misses === 0 && G.hits >= 25) s.cleanBlitz = true;
  Store.setAchStats(s);
}

function unlockAchievements() {
  const done = new Set(Store.getUnlocked());
  const fresh = [];
  for (let pass = 0; pass < 3; pass++) {
    const stats = Store.getAchStats();
    let hit = false;
    ACHIEVEMENTS.forEach(a => {
      if (done.has(a.id) || !a.check(stats)) return;
      done.add(a.id);
      Store.setUnlocked([...done]);
      Store.addCoins(a.reward);
      fresh.push(a);
      hit = true;
    });
    if (!hit) break;
  }
  return fresh;
}

function renderAchUnlocks(list) {
  if (!el.achUnlocks) return;
  if (!list.length) {
    el.achUnlocks.style.display = 'none';
    el.achUnlocks.innerHTML = '';
    return;
  }
  el.achUnlocks.style.display = 'flex';
  el.achUnlocks.innerHTML = list.map(a => `<span>🏅 ${a.name} · +${a.reward}</span>`).join('');
}

function renderAchievements() {
  const stats = Store.getAchStats();
  const done = new Set(Store.getUnlocked());
  const progress = $('ach-progress');
  if (progress) progress.textContent = done.size + ' / ' + ACHIEVEMENTS.length;
  const list = $('ach-list');
  if (!list) return;
  list.innerHTML = ACHIEVEMENTS.map(a => {
    const on = done.has(a.id);
    return `<div class="ach-card${on ? ' done' : ''}">
      <div class="ach-info">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
      <div class="ach-reward">${on ? '✓' : '+' + a.reward}</div>
    </div>`;
  }).join('');
}

function grantAchievements(where) {
  const fresh = unlockAchievements();
  if (where === 'gameover') renderAchUnlocks(fresh);
  if (fresh.length && where !== 'gameover') localStorage.setItem('reflex_ach_unseen', '1');
  return fresh;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Фоновая музыка
const bgm = new Audio('bgm.mp3');
bgm.loop = true;
bgm.volume = 0.2; // комфортная фоновая громкость

function playMusic() {
  if (!Store.getMusic()) return;
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (bgm.paused) {
    bgm.play().catch(() => {});
  }
}

function stopMusic() {
  bgm.pause();
}

/* ---------- СОЧНЫЕ ЗВУКИ (WEB AUDIO СИНТЕЗАТОР) ---------- */
let audioCtx = null;
let audioReady = false;

function armAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => { audioReady = true; playMusic(); }).catch(() => {});
  } else if (audioCtx) {
    audioReady = true;
    playMusic();
  }
}

// Слушаем все события — что-то да сработает первым
document.addEventListener('pointerdown', armAudio, { once: false });
document.addEventListener('touchstart', armAudio, { passive: true, once: false });
document.addEventListener('click', armAudio, { once: false });

// 🎈 СОЧНЫЙ ЛОПАЮЩИЙСЯ ШАРИК («ЧПОК»)
function playPop() {
  if (!Store.getSound() || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;

    // 1. Основа шарика: быстрый частотный взлёт («чпок»)
    // Лёгкий рандом высоты, чтобы каждый шар звучал уникально
    const baseFreq = 340 + Math.random() * 80;  // старт ~340-420 Hz
    const peakFreq = baseFreq * (2.2 + Math.random() * 0.4); // подскок до ~800-1100 Hz

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, t0 + 0.035);

    gain.gain.setValueAtTime(0.28, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.075);

    // 2. Атака: микро-щелчок разрыва оболочки шарика
    const snapOsc = audioCtx.createOscillator();
    const snapGain = audioCtx.createGain();

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(950, t0);
    snapOsc.frequency.exponentialRampToValueAtTime(180, t0 + 0.018);

    snapGain.gain.setValueAtTime(0.18, t0);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.02);

    snapOsc.connect(snapGain).connect(audioCtx.destination);
    snapOsc.start(t0);
    snapOsc.stop(t0 + 0.025);
  } catch(e) {}
}

// ⚡ ФУТУРИСТИЧЕСКИЙ POWER-UP (Активация бустера)
function playBooster() {
  if (!Store.getSound() || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;

    // 1. Восходящий энергетический импульс (свип 220 -> 900 Hz)
    const surge = audioCtx.createOscillator();
    const surgeGain = audioCtx.createGain();
    surge.type = 'sine';
    surge.frequency.setValueAtTime(220, t0);
    surge.frequency.exponentialRampToValueAtTime(880, t0 + 0.14);

    surgeGain.gain.setValueAtTime(0.25, t0);
    surgeGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);

    surge.connect(surgeGain).connect(audioCtx.destination);
    surge.start(t0);
    surge.stop(t0 + 0.3);

    // 2. Неоновый перелив/блеск на верхах (440 -> 1760 Hz)
    const shimmer = audioCtx.createOscillator();
    const shimmerGain = audioCtx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(440, t0);
    shimmer.frequency.exponentialRampToValueAtTime(1760, t0 + 0.16);

    shimmerGain.gain.setValueAtTime(0.15, t0);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

    shimmer.connect(shimmerGain).connect(audioCtx.destination);
    shimmer.start(t0);
    shimmer.stop(t0 + 0.24);
  } catch(e) {}
}

// ❌ ЗВОНКИЙ АРКАДНЫЙ «БОНЬК» ПРИ ОШИБКЕ (отлично слышен на смартфонах)
function playError() {
  if (!Store.getSound() || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;

    // 1. Звонкий металлический щелчок
    const snap = audioCtx.createOscillator();
    const snapGain = audioCtx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(480, t0);
    snap.frequency.exponentialRampToValueAtTime(140, t0 + 0.08);

    snapGain.gain.setValueAtTime(0.25, t0);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);

    snap.connect(snapGain).connect(audioCtx.destination);
    snap.start(t0);
    snap.stop(t0 + 0.1);

    // 2. Диссонирующий низкий тон для чувства ошибки
    const buzz = audioCtx.createOscillator();
    const buzzGain = audioCtx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(220, t0);
    buzz.frequency.exponentialRampToValueAtTime(90, t0 + 0.12);

    buzzGain.gain.setValueAtTime(0.08, t0);
    buzzGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);

    buzz.connect(buzzGain).connect(audioCtx.destination);
    buzz.start(t0);
    buzz.stop(t0 + 0.14);
  } catch(e) {}
}

// 🪙 Два коротких металлических щелчка: «тинь-тинь»
function playCoin() {
  if (!Store.getSound() || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [1046.5, 1568].forEach((freq, i) => coinTick(t0 + i * 0.09, freq));
  } catch (e) {}
}

function coinTick(t, freq) {
  const body = audioCtx.createOscillator();
  const spark = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  const sparkGain = audioCtx.createGain();

  body.type = 'triangle';
  body.frequency.setValueAtTime(freq * 1.35, t);
  body.frequency.exponentialRampToValueAtTime(freq, t + 0.055);

  spark.type = 'sine';
  spark.frequency.setValueAtTime(freq * 2.9, t);
  spark.frequency.exponentialRampToValueAtTime(freq * 2.2, t + 0.04);

  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.14, t + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

  sparkGain.gain.setValueAtTime(0.0001, t);
  sparkGain.gain.exponentialRampToValueAtTime(0.045, t + 0.003);
  sparkGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

  body.connect(bodyGain).connect(audioCtx.destination);
  spark.connect(sparkGain).connect(audioCtx.destination);
  body.start(t);
  spark.start(t);
  body.stop(t + 0.08);
  spark.stop(t + 0.05);
}

function haptic(kind) {
  if (!Store.getHaptic()) return;
  if (tg && tg.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
    try { tg.HapticFeedback.impactOccurred(kind || 'light'); return; } catch(e) {}
  }
  if (navigator.vibrate) navigator.vibrate(20);
}

/* ---------- ПАЛИТРЫ ---------- */
const SKINS = [
  { id: 'neon', name: 'NEON', price: 50, colors: ['#FF3B30', '#34C759', '#0A84FF', '#FFCC00', '#FF9500', '#AF52DE'] },
  { id: 'candy', name: 'CANDY', price: 100, colors: ['#FF2D78', '#BA68C8', '#F8BBD0', '#E040FB', '#FF5252', '#7C4DFF'] }
];
const COLOR_NAMES = {
  '#FF3B30':'КРАСНЫЙ', '#34C759':'ЗЕЛЕНЫЙ', '#0A84FF':'СИНИЙ', '#FFCC00':'ЖЕЛТЫЙ', '#FF9500':'ОРАНЖЕВЫЙ', '#AF52DE':'ФИОЛЕТОВЫЙ',
  '#FF2D78':'РОЗОВЫЙ', '#BA68C8':'СИРЕНЕВЫЙ', '#F8BBD0':'НЕЖНЫЙ', '#E040FB':'МАДЖЕНТА', '#FF5252':'КОРАЛЛ', '#7C4DFF':'ЛИЛОВЫЙ'
};

const TARGET_PERIOD = 4;
const TARGET_WARN = 0.6;
const DARK_MARKS = { '#FFCC00': true, '#F8BBD0': true };
const MARK_SVG = {
  '#FF3B30': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  '#34C759': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  '#0A84FF': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M12 4l8 16H4z"/></svg>',
  '#FFCC00': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.4 1.6 6.6L12 16.8 6.1 20.4l1.6-6.6L2.5 9.4l6.8-.6z"/></svg>',
  '#FF9500': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M12 3l8 9-8 9-8-9z"/></svg>',
  '#AF52DE': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="6"/></svg>',
  '#FF2D78': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/></svg>',
  '#BA68C8': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M8 4h8l4 8-4 8H8l-4-8z"/></svg>',
  '#F8BBD0': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  '#E040FB': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c2 4 6 6 6 10a6 6 0 1 1-12 0c0-1.5.6-2.8 1.2-4C8.2 7 10 5 12 3z"/></svg>',
  '#FF5252': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 8h14M7 12h10M9 16h6"/></svg>',
  '#7C4DFF': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 10-14h-7z"/></svg>'
};

function markHtml(color) {
  const svg = MARK_SVG[color] || MARK_SVG['#FF3B30'];
  const tone = DARK_MARKS[color] ? ' dark' : '';
  return '<span class="mark' + tone + '">' + svg + '</span>';
}

function currentSkin() {
  const id = Store.getEquipped();
  return SKINS.find(s => s.id === id) || SKINS[0];
}

/* ---------- БУСТЕРЫ КОНФИГ ---------- */
const BOOSTERS = [
  { id: 'time',   name: '+15 СЕК',  desc: '+15 секунд к таймеру (Блиц)',  price: 50,  color: '#00E5FF', icon: 'clock' },
  { id: 'life',   name: '+1 ЖИЗНЬ', desc: '+1 сердечко (Выживание)',      price: 100, color: '#FF3B30', icon: 'heart' },
  { id: 'freeze', name: 'ФРИЗ',     desc: 'Круги и таймер стоят 5 сек',   price: 80,  color: '#4DD0E1', icon: 'snowflake' },
  { id: 'magnet', name: 'МАГНИТ',   desc: 'Подсвечивает нужный цвет 5 сек', price: 150, color: '#FF9500', icon: 'magnet' }
];

const BOOSTER_SVGS = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  snowflake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>',
  magnet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v9a6 6 0 0 0 12 0V3"/><path d="M6 3h4v4H6z"/><path d="M14 3h4v4h-4z"/></svg>'
};

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const el = {
  menuBestBlitz: $('menu-best-blitz'),
  menuBestSurvival: $('menu-best-survival'),
  menuCoins: $('menu-coins'),
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudMultiplier: $('hud-multiplier'),
  hudHearts: $('hud-hearts'),
  hearts: Array.from(document.querySelectorAll('#hud-hearts .heart')),
  targetCircle: $('target-circle'),
  targetRow: $('target-row'),
  targetLabel: $('target-label'),
  playArea: $('play-area'),
  boosterBar: $('booster-bar'),
  progressFill: $('progress-fill'),
  levelLabel: $('level-label'),
  finalScore: $('final-score'),
  pointsLabel: $('points-label'),
  recordBadge: $('record-badge'),
  coinsBanner: $('coins-banner'),
  dailyBadge: $('daily-completed-badge'),
  dailyGap: $('daily-gap'),
  achUnlocks: $('ach-unlocks'),
  subScore: $('sub-score'),
  runStats: $('run-stats'),
  pauseOverlay: $('pause-overlay'),
  lbList: $('lb-list'),
  skinGrid: $('skin-grid'),
  boosterGrid: $('booster-grid'),
  shopCoins: $('shop-coins'),
  shopTitle: $('shop-title')
};

/* ---------- СОСТОЯНИЕ ИГРЫ ---------- */
let G = null;
let playRect = { width: 340, height: 400 };

function updatePlayRect() {
  if (!el.playArea) return;
  const r = el.playArea.getBoundingClientRect();
  if (r.width > 0) playRect = { width: r.width, height: r.height };
}
window.addEventListener('resize', updatePlayRect);

function newGameState(mode) {
  const palette = currentSkin().colors;
  return {
    mode, // 'blitz' | 'survival'
    score: 0,
    lives: mode === 'survival' ? 3 : 0,
    maxLives: 3,
    timeLeft: mode === 'blitz' ? 60 : 0,
    multiplier: 1,
    maxMultiplier: 1,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    wrongs: 0,
    misses: 0,
    level: 1,
    progress: 0,
    spawnInterval: 1400,
    lastSpawn: 0,
    targetColor: null,
    targetAge: 0,
    circles: new Set(),
    running: false,
    rafId: null,
    lastFrame: 0,
    freezeUntil: 0,
    magnetUntil: 0,
    timeLockUntil: 0,
    userPaused: false,
    autoPaused: false,
    pauseStarted: 0,
    finished: false
  };
}

/* ---------- ОСНОВНОЙ ИГРОВОЙ ЦИКЛ ---------- */
function loop(ts) {
  if (!G || !G.running) return;

  if (!G.lastFrame) G.lastFrame = ts;
  const dt = Math.min(0.1, (ts - G.lastFrame) / 1000);
  G.lastFrame = ts;

  const now = Date.now();
  const isFrozen = now < G.freezeUntil;

  // 1. Таймер режимов игры
  if (G.mode === 'blitz') {
    if (!isFrozen) {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        updateHud();
        endGame();
        return;
      }
    }
  } else {
    // В режиме выживания секундомер тикает вверх
    G.timeLeft += dt;
  }

  // 2. Смена цели по таймеру. За 0.6 с до смены цель пульсирует.
  if (!isFrozen) {
    G.targetAge += dt;
    setTargetWarning(G.targetAge >= TARGET_PERIOD - TARGET_WARN);
    if (G.targetAge >= TARGET_PERIOD) rollTarget();
  } else {
    setTargetWarning(false);
  }

  // 3. Спавн шаров по таймеру
  G.lastSpawn += dt * 1000;
  if (G.lastSpawn >= G.spawnInterval) {
    G.lastSpawn = 0;
    spawnCircle(ts);
  }

  // 4. Магнит: подсветка кругов текущего цвета, тап остаётся за игроком
  updateMagnetHints();

  // 5. Движение шаров и упругий отскок от границ поля
  const circles = Array.from(G.circles);
  for (const c of circles) {
    if (!G.running) return;
    if ((c.vx || c.vy) && !isFrozen) {
      c.x += c.vx * dt * 60;
      c.y += c.vy * dt * 60;

      const maxX = playRect.width - c.r * 2;
      const maxY = playRect.height - c.r * 2;

      if (c.x < 0)    { c.x = 0;    c.vx = Math.abs(c.vx); }
      if (c.x > maxX) { c.x = maxX; c.vx = -Math.abs(c.vx); }
      if (c.y < 0)    { c.y = 0;    c.vy = Math.abs(c.vy); }
      if (c.y > maxY) { c.y = maxY; c.vy = -Math.abs(c.vy); }
    }

    // Сгорание по таймауту жизни (2.5 сек)
    if (ts - c.born > 2500 && !isFrozen) {
      if (c.color === G.targetColor) {
        punishMiss(c);
        if (!G.running) return;
      }
      removeCircle(c, 'wrong');
    }
  }

  // 6. Бильярдная физика: упругий отскок шаров ДРУГ ОТ ДРУГА (защита от наложений)
  if (!isFrozen) {
    const arr = Array.from(G.circles);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const c1 = arr[i];
        const c2 = arr[j];
        if (c1.dead || c2.dead) continue;

        const dx = (c2.x + c2.r) - (c1.x + c1.r);
        const dy = (c2.y + c2.r) - (c1.y + c1.r);
        const dist = Math.hypot(dx, dy);
        const minDist = c1.r + c2.r + 4; // Безопасный зазор

        if (dist < minDist && dist > 0) {
          // Раздвигаем шары, чтобы не слипались
          const overlap = 0.5 * (minDist - dist);
          const nx = dx / dist;
          const ny = dy / dist;
          c1.x -= nx * overlap;
          c1.y -= ny * overlap;
          c2.x += nx * overlap;
          c2.y += ny * overlap;

          // Обмен импульсом (упругий удар)
          const kx = c1.vx - c2.vx;
          const ky = c1.vy - c2.vy;
          const p = nx * kx + ny * ky;
          c1.vx -= p * nx;
          c1.vy -= p * ny;
          c2.vx += p * nx;
          c2.vy += p * ny;
        }
      }
    }
  }

  // 7. Обновление визуальных позиций в DOM
  G.circles.forEach(c => {
    c.node.style.left = c.x + 'px';
    c.node.style.top = c.y + 'px';
  });

  // 8. Обновление HUD и таймеров активных бустеров
  updateHud();
  updateInGameBoostersState();

  // 9. Запрос следующего кадра анимации
  if (G.running) {
    G.rafId = requestAnimationFrame(loop);
  }
}
function updateMagnetHints() {
  if (!G) return;
  const on = Date.now() < G.magnetUntil;
  G.circles.forEach(c => {
    if (c.dead) return;
    c.node.classList.toggle('hint', on && c.color === G.targetColor);
  });
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.backgroundColor = color;
    p.style.boxShadow = '0 0 10px ' + color;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
    const dist = 28 + Math.random() * 20;
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    el.playArea.appendChild(p);
    setTimeout(() => p.remove(), 320);
  }
}

function findFreePosition(r, maxAttempts = 20) {
  const size = r * 2;
  const maxX = Math.max(1, playRect.width - size);
  const maxY = Math.max(1, playRect.height - size);
  const gap = 12; // Минимальный зазор между краями шаров

  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    let collided = false;

    for (const other of G.circles) {
      if (other.dead) continue;
      const dx = (x + r) - (other.x + other.r);
      const dy = (y + r) - (other.y + other.r);
      const minDist = r + other.r + gap;
      if (dx * dx + dy * dy < minDist * minDist) {
        collided = true;
        break;
      }
    }

    if (!collided) return { x, y };
  }

  return null;
}

function spawnCircle(now) {
  if (G.circles.size >= 5) return;
  const r = 38 + Math.random() * 16;
  
  // Ищем свободное место:
  const pos = findFreePosition(r);
  if (!pos) return; // Если свободного пятачка нет — пропускаем спавн до освобождения места

  const size = r * 2;
  const colors = currentSkin().colors.slice(0, Math.min(6, 3 + G.level));
  const color = Math.random() < 0.5 ? G.targetColor : colors[Math.floor(Math.random() * colors.length)];

  const node = document.createElement('div');
  node.className = 'circle';
  node.style.width = size + 'px';
  node.style.height = size + 'px';
  node.style.left = pos.x + 'px';
  node.style.top = pos.y + 'px';
  node.style.backgroundColor = color;
  node.style.boxShadow = '0 0 24px ' + color;
  node.innerHTML = markHtml(color);

  const circle = { node, color, r, x: pos.x, y: pos.y, born: now, vx: 0, vy: 0, dead: false };

  // Скорость движения шаров
  if (G.level >= 2 || (G.mode === 'survival' && G.timeLeft > 15)) {
    const spd = G.mode === 'survival' ? (2 + G.timeLeft * 0.04) : 2.4;
    const ang = Math.random() * Math.PI * 2;
    circle.vx = Math.cos(ang) * spd;
    circle.vy = Math.sin(ang) * spd;
  }

  node.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    onCircleTap(circle);
  });

  el.playArea.appendChild(node);
  G.circles.add(circle);
}

function onCircleTap(circle) {
  if (!G || !G.running || circle.dead) return;

  if (circle.color === G.targetColor) {
    G.combo++;
    G.multiplier = G.combo >= 20 ? 5 : G.combo >= 10 ? 3 : G.combo >= 5 ? 2 : 1;

    if (G.multiplier > G.maxMultiplier) G.maxMultiplier = G.multiplier;

    G.hits++;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    G.score += G.multiplier;
    G.progress += 8;
    if (G.progress >= 100) {
      G.progress = 0;
      G.level++;
      G.spawnInterval = Math.max(600, G.spawnInterval * 0.88);
    }
    scorePop(circle, '+' + G.multiplier, circle.color);
    spawnParticles(circle.x + circle.r, circle.y + circle.r, circle.color);
    removeCircle(circle, 'tapped');
    playPop();
    haptic('light');
  } else {
    G.wrongs++;
    playError();
    haptic('error');
    document.body.classList.remove('shaking');
    void document.body.offsetWidth;
    document.body.classList.add('shaking');

    if (G.mode === 'blitz') {
      G.timeLeft = Math.max(0, G.timeLeft - 3);
      G.combo = 0;
      G.multiplier = 1;
      scorePop(circle, '-3s', '#FF3B30');
      removeCircle(circle, 'wrong');
      if (G.timeLeft <= 0) {
        endGame();
        return;
      }
    } else {
      G.lives--;
      G.combo = 0;
      G.multiplier = 1;
      removeCircle(circle, 'wrong');
      if (G.lives <= 0) {
        endGame();
        return;
      }
    }
  }
  updateHud();
}

function removeCircle(circle, animClass) {
  if (circle.dead) return;
  circle.dead = true;
  G.circles.delete(circle);
  circle.node.classList.add(animClass);
  setTimeout(() => circle.node.remove(), 200);
}

function setTargetWarning(on) {
  el.targetCircle.classList.toggle('warn', on);
  if (el.targetRow) el.targetRow.classList.toggle('warn', on);
}

function punishMiss(circle) {
  G.combo = 0;
  G.multiplier = 1;
  G.misses++;
  playError();
  haptic('error');
  document.body.classList.remove('shaking');
  void document.body.offsetWidth;
  document.body.classList.add('shaking');

  if (G.mode === 'blitz') {
    G.timeLeft = Math.max(0, G.timeLeft - 2);
    scorePop(circle, '-2s', '#FF3B30');
    if (G.timeLeft <= 0) endGame();
  } else {
    G.lives--;
    scorePop(circle, '-1', '#FF3B30');
    if (G.lives <= 0) endGame();
  }
}

function setTarget(color) {
  G.targetColor = color;
  G.targetAge = 0;
  el.targetCircle.style.backgroundColor = color;
  el.targetCircle.style.boxShadow = '0 0 20px ' + color;
  el.targetCircle.innerHTML = markHtml(color);
  setTargetWarning(false);
  el.targetLabel.textContent = 'ТАПАЙ ' + (COLOR_NAMES[color] || 'ЦВЕТ');
}

function rollTarget() {
  const colors = currentSkin().colors.slice(0, Math.min(6, 3 + G.level));
  const avail = colors.filter(c => c !== G.targetColor);
  setTarget(avail[Math.floor(Math.random() * avail.length)] || colors[0]);
}

function updateHud() {
  if (!G) return;
  if (G.mode === 'blitz') {
    el.hudTime.textContent = Math.ceil(G.timeLeft) + 's';
    el.hudHearts.style.display = 'none';
  } else {
    el.hudTime.textContent = Math.floor(G.timeLeft) + 's';
    el.hudHearts.style.display = 'flex';
    el.hearts.forEach((h, i) => h.classList.toggle('lost', i >= G.lives));
  }
  
  el.hudScore.textContent = G.score;
  el.hudMultiplier.textContent = 'x' + G.multiplier;
  el.levelLabel.textContent = 'LEVEL ' + G.level;
  el.progressFill.style.width = Math.min(100, G.progress) + '%';

  // ПЕРЕКРАШИВАНИЕ ОГОНЬКА И МНОЖИТЕЛЯ:
  const comboBox = $('hud-combo-box');
  if (comboBox) {
    comboBox.className = 'hud-right combo-' + G.multiplier;
  }
}

function scorePop(circle, text, color) {
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = text;
  pop.style.color = color;
  pop.style.left = circle.x + circle.r + 'px';
  pop.style.top = circle.y + 'px';
  el.playArea.appendChild(pop);
  setTimeout(() => pop.remove(), 450);
}

/* ---------- УМНАЯ ПАНЕЛЬ БУСТЕРОВ В БОЮ ---------- */
function initInGameBoosters() {
  if (!G) { el.boosterBar.style.display = 'none'; return; }
  const inv = Store.getBoosters();

  const valid = BOOSTERS.filter(b => {
    if (G.mode === 'blitz' && b.id === 'life') return false;
    if (G.mode === 'survival' && b.id === 'time') return false;
    return (inv[b.id] || 0) > 0;
  });

  if (!valid.length) {
    el.boosterBar.style.display = 'none';
    el.boosterBar.innerHTML = '';
    return;
  }

  el.boosterBar.style.display = 'flex';
  el.boosterBar.innerHTML = valid.map(b => `
    <button class="bb-btn" data-id="${b.id}" style="color:${b.color}">
      ${BOOSTER_SVGS[b.icon]}
      <span class="bb-count">×${inv[b.id]}</span>
    </button>
  `).join('');

  el.boosterBar.querySelectorAll('.bb-btn').forEach(btn => {
    btn.onpointerdown = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      useBoosterInGame(btn.dataset.id);
    };
  });
}

function useBoosterInGame(id) {
  if (!G || !G.running) return;
  const now = Date.now();

  if (id === 'freeze' && now < G.freezeUntil) return;
  if (id === 'magnet' && now < G.magnetUntil) return;
  if (id === 'time' && now < G.timeLockUntil) return;

  if (id === 'life') {
    if (G.lives >= G.maxLives) return;
  }

  const inv = Store.getBoosters();
  if (!inv[id] || inv[id] <= 0) return;

  Store.useBooster(id);

  if (id === 'freeze') {
    G.freezeUntil = now + 5000;
  } else if (id === 'magnet') {
    G.magnetUntil = now + 5000;
    updateMagnetHints();
    showBoosterPopup('МЕТКА', '#FF9500');
  } else if (id === 'time') {
    G.timeLeft += 15;
    G.timeLockUntil = now + 3000;
    showBoosterPopup('+15s', '#00E5FF');
  } else if (id === 'life') {
    G.lives = Math.min(G.maxLives, G.lives + 1);
    showBoosterPopup('+1 ❤', '#FF3B30');
  }

  playBooster();
  haptic('medium');
  updateHud();
  updateInGameBoostersState();
}

function showBoosterPopup(text, color) {
  const pop = document.createElement('div');
  pop.className = 'booster-popup';
  pop.textContent = text;
  pop.style.color = color;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

function updateInGameBoostersState() {
  if (!G || !G.running || el.boosterBar.style.display === 'none') return;
  const now = Date.now();
  const inv = Store.getBoosters();

  let hasVisibleButtons = false;

  el.boosterBar.querySelectorAll('.bb-btn').forEach(btn => {
    const id = btn.dataset.id;
    let activeSec = 0;

    if (id === 'freeze' && now < G.freezeUntil) activeSec = (G.freezeUntil - now) / 1000;
    if (id === 'magnet' && now < G.magnetUntil) activeSec = (G.magnetUntil - now) / 1000;
    if (id === 'time'   && now < G.timeLockUntil) activeSec = (G.timeLockUntil - now) / 1000;

    const isActive = activeSec > 0;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('locked', isActive);

    const countNode = btn.querySelector('.bb-count');
    const remaining = inv[id] || 0;

    if (isActive) {
      if (countNode) countNode.textContent = Math.ceil(activeSec) + 's';
      hasVisibleButtons = true;
    } else {
      if (remaining <= 0) {
        btn.remove();
      } else {
        if (countNode) countNode.textContent = '×' + remaining;
        hasVisibleButtons = true;
      }
    }
  });

  if (!hasVisibleButtons) {
    el.boosterBar.style.display = 'none';
  }
}

/* ---------- СТАРТ / ФИНИШ ---------- */
function startGame(mode) {
  G = newGameState(mode);
  G.running = true;

  el.playArea.innerHTML = '';
  if (el.pauseOverlay) el.pauseOverlay.classList.remove('open');
  setTarget(currentSkin().colors[0]);
  rollTarget();
  showScreen('game');
  updateHud();

  initInGameBoosters();
  updatePlayRect();

  G.rafId = requestAnimationFrame(loop);
}

function shiftActiveBoosters(fromTs, delta) {
  if (!G || delta <= 0) return;
  ['freezeUntil', 'magnetUntil', 'timeLockUntil'].forEach(key => {
    if (G[key] > fromTs) G[key] += delta;
  });
}

function pauseGame() {
  if (!G || !G.running || G.finished) return;
  G.running = false;
  G.userPaused = true;
  G.pauseStarted = Date.now();
  cancelAnimationFrame(G.rafId);
  el.pauseOverlay.classList.add('open');
}

function resumeGame() {
  if (!G || !G.userPaused || G.finished) return;
  const started = G.pauseStarted || Date.now();
  shiftActiveBoosters(started, Date.now() - started);
  G.userPaused = false;
  G.running = true;
  G.lastFrame = 0;
  el.pauseOverlay.classList.remove('open');
  G.rafId = requestAnimationFrame(loop);
}

function renderRunStats() {
  const attempts = G.hits + G.wrongs + G.misses;
  const accuracy = attempts ? Math.round(100 * G.hits / attempts) : 0;
  const errors = G.wrongs + G.misses;
  el.runStats.innerHTML = [
    [accuracy + '%', 'ТОЧНОСТЬ'],
    [String(G.maxCombo), 'КОМБО'],
    [String(G.level), 'УРОВЕНЬ'],
    [String(errors), 'ОШИБКИ']
  ].map(([value, label]) => `<div class="run-stat"><b>${value}</b><span>${label}</span></div>`).join('');
}

function dailyShortfall(task) {
  if (task.kind !== 'combo' && G.mode !== task.mode) {
    return task.mode === 'survival'
      ? 'ЗАДАНИЕ ДНЯ — РЕЖИМ ВЫЖИВАНИЕ'
      : 'ЗАДАНИЕ ДНЯ — РЕЖИМ БЛИЦ';
  }
  if (task.kind === 'score') return 'НАБРАНО ' + G.score + ' ИЗ ' + task.need;
  if (task.kind === 'time') return 'ВЫЖИЛ ' + Math.floor(G.timeLeft) + 'С ИЗ ' + task.need;
  return 'КОМБО x' + G.maxMultiplier + ', НУЖНО x' + task.need;
}

function endGame() {
  if (!G || G.finished) return;
  G.finished = true;
  G.running = false;
  G.userPaused = false;
  G.autoPaused = false;
  cancelAnimationFrame(G.rafId);
  G.circles.forEach(c => c.node.remove());
  G.circles.clear();
  el.boosterBar.style.display = 'none';
  el.pauseOverlay.classList.remove('open');
  setTargetWarning(false);

  let isRecord = false;
  let coins = 0;

  if (G.mode === 'blitz') {
    const best = Store.getBestBlitz();
    if (G.score > best) { Store.setBestBlitz(G.score); isRecord = true; }
    coins = Math.floor(G.score / 2);
    el.finalScore.textContent = G.score;
    el.pointsLabel.textContent = 'ОЧКОВ В БЛИЦЕ';
  } else {
    const survivalSec = Math.floor(G.timeLeft);
    const best = Store.getBestSurvival();
    if (survivalSec > best) { Store.setBestSurvival(survivalSec); isRecord = true; }
    coins = Math.floor(G.score / 2);
    el.finalScore.textContent = survivalSec + 's';
    el.pointsLabel.textContent = 'ВРЕМЯ ВЫЖИВАНИЯ';
  }

  if (G.mode === 'survival') {
    el.subScore.style.display = 'block';
    el.subScore.textContent = G.score + ' ОЧКОВ';
  } else {
    el.subScore.style.display = 'none';
  }
  renderRunStats();
  noteRunStats();

  Store.addCoins(coins);
  Store.addRun({
    mode: G.mode,
    score: G.score,
    time: Math.floor(G.timeLeft),
    combo: G.maxCombo,
    level: G.level
  });
  el.recordBadge.style.display = isRecord ? 'block' : 'none';
  el.coinsBanner.textContent = '+' + coins + ' МОНЕТ';

  if (coins > 0) {
    setTimeout(playCoin, 250);
  }

  const todayTask = getTodayTask();
  const alreadyDone = Store.getDailyDone();
  if (!alreadyDone && todayTask.check(G)) {
    Store.setDailyDone();
    Store.addCoins(todayTask.reward);
    el.dailyBadge.textContent = `🎉 ЗАДАНИЕ ДНЯ ВЫПОЛНЕНО! +${todayTask.reward} 🪙`;
    el.dailyBadge.style.display = 'block';
    el.dailyGap.style.display = 'none';
    const ach = Store.getAchStats();
    ach.dailies = (ach.dailies || 0) + 1;
    Store.setAchStats(ach);
    setTimeout(playCoin, 550);
  } else if (!alreadyDone) {
    el.dailyBadge.style.display = 'none';
    el.dailyGap.textContent = dailyShortfall(todayTask);
    el.dailyGap.style.display = 'block';
  } else {
    el.dailyBadge.style.display = 'none';
    el.dailyGap.style.display = 'none';
  }

  const freshAch = grantAchievements('gameover');
  if ((coins > 0 || freshAch.length) && coins === 0) setTimeout(playCoin, 250);

  updateShareButtonUI();
  refreshMenu();
  showScreen('gameover');
}

/* ---------- НАВИГАЦИЯ И МЕНЮ ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $('screen-' + id);
  if (target) target.classList.add('active');

  if (tg && tg.BackButton && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
    try {
      if (id === 'shop' || id === 'leaderboard' || id === 'achievements') {
        tg.BackButton.show();
        tg.BackButton.onClick(onBackNav);
      } else {
        tg.BackButton.hide();
        tg.BackButton.offClick(onBackNav);
      }
    } catch(e) {}
  }
}

function onBackNav() {
  showScreen('menu');
}

function refreshMenu() {
  if (el.menuBestBlitz) el.menuBestBlitz.textContent = Store.getBestBlitz();
  if (el.menuBestSurvival) el.menuBestSurvival.textContent = Store.getBestSurvival() + 's';
  if (el.menuCoins) el.menuCoins.textContent = Store.getCoins();
  if (el.shopCoins) el.shopCoins.textContent = Store.getCoins();
  const achDot = $('ach-dot');
  if (achDot) achDot.style.display = localStorage.getItem('reflex_ach_unseen') === '1' ? 'block' : 'none';

  const isDone = Store.getDailyDone();
  const todayTask = getTodayTask();
  const btnDaily = $('btn-daily');
  const taskDesc = $('daily-task-desc');
  const rewardPill = $('daily-reward-pill');
  const dailyIcon = $('daily-icon');

  if (btnDaily) btnDaily.classList.toggle('completed', isDone);

  if (isDone) {
    if (taskDesc) taskDesc.textContent = 'ЗАДАНИЕ ВЫПОЛНЕНО';
    if (rewardPill) {
      rewardPill.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }
    if (dailyIcon) {
      dailyIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      `;
    }
  } else {
    // Показываем текст и награду текущего дня недели!
    if (taskDesc) taskDesc.textContent = todayTask.text;
    if (rewardPill) rewardPill.textContent = '+' + todayTask.reward;
    if (dailyIcon) {
      dailyIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      `;
    }
  }
}

let lbMode = 'blitz';
function renderLeaderboard() {
  document.querySelectorAll('#lb-tabs .shop-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.lb === lbMode);
  });

  const runs = Store.getRuns()
    .filter(run => run.mode === lbMode)
    .sort((a, b) => b.score - a.score || b.combo - a.combo)
    .slice(0, 10);

  if (!runs.length) {
    el.lbList.innerHTML = '<div class="lb-empty">Пока нет забегов в этом режиме</div>';
    return;
  }

  el.lbList.innerHTML = runs.map((run, idx) => {
    const meta = lbMode === 'survival'
      ? `${run.time}с · комбо ${run.combo}`
      : `комбо ${run.combo} · ур. ${run.level}`;
    return `
      <div class="lb-item${idx === 0 ? ' best' : ''}">
        <span class="lb-main"><b>#${idx + 1}</b><span class="lb-meta">${meta}</span></span>
        <b>${run.score}</b>
      </div>
    `;
  }).join('');
}

let shopTab = 'boosters';
function renderShop() {
  refreshMenu();
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === shopTab));
  el.shopTitle.textContent = shopTab === 'skins' ? 'ПАЛИТРЫ ЦВЕТОВ' : 'БУСТЕРЫ';

  if (shopTab === 'skins') {
    el.skinGrid.style.display = 'grid';
    el.boosterGrid.style.display = 'none';
    renderSkins();
  } else {
    el.skinGrid.style.display = 'none';
    el.boosterGrid.style.display = 'flex';
    renderBoostersShop();
  }
}

function renderBoostersShop() {
  const inv = Store.getBoosters();
  el.boosterGrid.innerHTML = '';

  BOOSTERS.forEach(b => {
    const card = document.createElement('div');
    card.className = 'booster-card';
    const count = inv[b.id] || 0;

    card.innerHTML = `
      <div class="booster-icon" style="color:${b.color}">${BOOSTER_SVGS[b.icon]}</div>
      <div class="booster-info">
        <div class="booster-name">${b.name}${count > 0 ? `<span class="booster-count">×${count}</span>` : ''}</div>
        <div class="booster-desc">${b.desc}</div>
      </div>
      <button class="booster-buy">
        <span>${b.price}</span>
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FFD60A"/><circle cx="12" cy="12" r="7" fill="none" stroke="#B8860B" stroke-width="1.5"/></svg>
      </button>
    `;

    card.querySelector('.booster-buy').onclick = (e) => {
      e.stopPropagation();
      if (Store.getCoins() < b.price) {
        playError();
        return;
      }
      Store.addCoins(-b.price);
      Store.addBooster(b.id, 1);
      playCoin();
      haptic('medium');
      renderShop();
    };

    el.boosterGrid.appendChild(card);
  });
}

function renderSkins() {
  const owned = Store.getSkins() || ['neon'];
  const equipped = Store.getEquipped();
  el.skinGrid.innerHTML = '';

  SKINS.forEach(skin => {
    const isOwned = owned.includes(skin.id);
    const isEquipped = skin.id === equipped;
    const card = document.createElement('div');
    card.className = 'skin-card' + (isEquipped ? ' equipped' : '');
    card.innerHTML = `
      <div class="skin-preview">
        ${skin.colors.slice(0, 3).map(c => `<span class="dot" style="background:${c}"></span>`).join('')}
      </div>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-price">${isEquipped ? 'АКТИВЕН' : isOwned ? 'КУПЛЕН' : skin.price + ' 🪙'}</div>
    `;
    card.onclick = () => {
      if (isOwned) {
        Store.setEquipped(skin.id);
      } else if (Store.getCoins() >= skin.price) {
        Store.addCoins(-skin.price);
        owned.push(skin.id);
        Store.setSkins(owned);
        Store.setEquipped(skin.id);
        playCoin();
        grantAchievements('menu');
      } else {
        playError();
        return;
      }
      renderShop();
    };
    el.skinGrid.appendChild(card);
  });
}

/* ---------- ОНБОРДИНГ И СТАРТОВЫЙ БОНУС ---------- */
let onboardSlide = 0;
function showOnboardSlide(i) {
  onboardSlide = i;
  document.querySelectorAll('.onboard-slide').forEach(s => s.classList.toggle('active', +s.dataset.slide === i));
  document.querySelectorAll('#onboard-dots .ob-pip').forEach((p, j) => p.classList.toggle('active', j === i));
  $('btn-onboard-next').textContent = i === 2 ? 'ЗАБРАТЬ И ИГРАТЬ' : 'ДАЛЕЕ';
}

function onboardNext() {
  playPop();
  if (onboardSlide < 2) {
    showOnboardSlide(onboardSlide + 1);
    return;
  }

  // НАЧИСЛЕНИЕ СТАРТОВОГО ПОДАРКА НОВИЧКУ:
  Store.addCoins(50);
  Store.addBooster('time', 1);
  Store.addBooster('life', 1);
  Store.addBooster('freeze', 1);
  Store.addBooster('magnet', 1);

  playCoin();
  haptic('medium');
  localStorage.setItem('reflex_onboarded', 'true');
  refreshMenu();
  showScreen('menu');
}

/* ---------- НАЗНАЧЕНИЕ КНОПОК ---------- */
$('btn-onboard-next').onclick = onboardNext;

$('btn-play-blitz').onclick = () => startGame('blitz');
$('btn-play-survival').onclick = () => startGame('survival');
$('btn-daily').onclick = () => {
  if (Store.getDailyDone()) {
    if (tg && tg.showAlert) tg.showAlert('Задание на сегодня уже выполнено!');
    else alert('Задание на сегодня уже выполнено!');
  } else {
    startGame(getTodayTask().mode);
  }
};

$('btn-again').onclick = () => startGame(G.mode);
$('btn-menu').onclick = () => showScreen('menu');

$('btn-shop').onclick = () => { shopTab = 'boosters'; renderShop(); showScreen('shop'); };
$('btn-shop-back').onclick = onBackNav;
document.querySelectorAll('#screen-shop .shop-tab').forEach(t => {
  t.onclick = () => { shopTab = t.dataset.tab; renderShop(); };
});

$('btn-leaderboard').onclick = () => { renderLeaderboard(); showScreen('leaderboard'); };
$('btn-achievements').onclick = () => {
  localStorage.removeItem('reflex_ach_unseen');
  renderAchievements();
  showScreen('achievements');
  refreshMenu();
};
$('btn-ach-back').onclick = onBackNav;
document.querySelectorAll('#lb-tabs .shop-tab').forEach(t => {
  t.onclick = () => { lbMode = t.dataset.lb; renderLeaderboard(); };
});
$('btn-pause').onclick = (ev) => { ev.stopPropagation(); pauseGame(); };
$('btn-resume').onclick = resumeGame;
$('btn-pause-end').onclick = () => endGame();
$('btn-lb-back').onclick = onBackNav;

function syncSettingsToggles() {
  $('toggle-music').classList.toggle('on', Store.getMusic());
  $('toggle-sound').classList.toggle('on', Store.getSound());
  $('toggle-haptic').classList.toggle('on', Store.getHaptic());
}

$('btn-settings').onclick = () => {
  syncSettingsToggles();
  $('settings-modal').style.display = 'flex';
};
$('btn-close-settings').onclick = () => $('settings-modal').style.display = 'none';

$('toggle-music').onclick = function() {
  Store.setMusic(!Store.getMusic());
  this.classList.toggle('on', Store.getMusic());
  if (Store.getMusic()) {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    playMusic();
  } else {
    stopMusic();
  }
};

$('toggle-sound').onclick = function() {
  Store.setSound(!Store.getSound());
  this.classList.toggle('on', Store.getSound());
  // Принудительно будим audioCtx, когда включаем звук
  if (Store.getSound() && audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (Store.getSound()) playPop(); // тестовый звук
};
$('toggle-haptic').onclick = function() {
  Store.setHaptic(!Store.getHaptic());
  this.classList.toggle('on', Store.getHaptic());
};
$('btn-reset').onclick = () => {
  if (confirm('Сбросить весь прогресс?')) {
    Store.reset();
    location.reload();
  }
};
$('btn-share').onclick = doShare;

/* СТАРТ */
migrateAchStats();
if (unlockAchievements().length) localStorage.setItem('reflex_ach_unseen', '1');
updatePlayRect();
if (localStorage.getItem('reflex_onboarded') !== 'true') {
  showOnboardSlide(0);
  showScreen('onboard');
} else {
  refreshMenu();
  showScreen('menu');
}

function canGetShareBonus() {
  return localStorage.getItem('reflex_last_share_date') !== todayStr();
}

function doShare() {
  if (!G) return;
  playPop();
  haptic('light');

  const scoreText = G.mode === 'blitz'
    ? `⚡ Я набрал ${G.score} очков в Блице в игре REFLEX! Сможешь быстрее?`
    : `❤️ Я продержался ${Math.floor(G.timeLeft)} сек. и набрал ${G.score} очков в Выживании в REFLEX! Попробуй побить мой рекорд:`;

  // Формируем нативную ссылку для шаринга в Telegram
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(TELEGRAM_APP_URL)}&text=${encodeURIComponent(scoreText)}`;

  // 1. Если запущен внутри Telegram — открываем нативный выбор чата
  if (tg && tg.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
  } 
  // 2. Если на мобильном в обычном браузере — Web Share API
  else if (navigator.share) {
    navigator.share({ title: 'REFLEX', text: scoreText, url: TELEGRAM_APP_URL }).catch(() => {});
  } 
  // 3. Фолбэк для ПК-браузера — открываем окно Telegram Share
  else {
    window.open(shareUrl, '_blank');
  }

  // Награда 50 монет 1 раз в сутки за репост
  if (canGetShareBonus()) {
    localStorage.setItem('reflex_last_share_date', todayStr());
    Store.addCoins(50);
    grantAchievements('menu');
    playCoin();
    haptic('medium');
    refreshMenu();  
    updateShareButtonUI();
  }
}

function updateShareButtonUI() {
  const bonusPill = $('share-bonus-pill');
  if (bonusPill) {
    bonusPill.style.display = canGetShareBonus() ? 'inline-block' : 'none';
  }
}

/* ---------- ПАУЗА ПРИ СВОРАЧИВАНИИ ПРИЛОЖЕНИЯ ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopMusic();
    if (G && G.running && !G.finished) {
      G.running = false;
      cancelAnimationFrame(G.rafId);
      G.autoPaused = true;
      G.pauseStarted = Date.now();
    }
  } else {
    if (Store.getMusic()) playMusic();
    if (G && G.autoPaused && !G.userPaused && !G.finished) {
      const started = G.pauseStarted || Date.now();
      shiftActiveBoosters(started, Date.now() - started);
      G.autoPaused = false;
      G.running = true;
      G.lastFrame = 0;
      G.rafId = requestAnimationFrame(loop);
    }
  }
});