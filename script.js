// ══════ Memories Player ══════
const mpMedia = [
  { type: "video", src: "", caption: "" },
];

(function () {
  const FADE_MS = 550;
  const KB_LIST = ['mp-kb-in', 'mp-kb-out', 'mp-kb-lr', 'mp-kb-ud'];

  let idx = 0;
  let playing = false;
  let muted = false;
  let started = false;
  let active = 'a';
  let currentVid = null;
  let clipTimer, progTimer;

  const overlay = document.getElementById('memoriesPlayerOverlay');
  const slotA = document.getElementById('mpSlotA');
  const slotB = document.getElementById('mpSlotB');
  const fadeEl = document.getElementById('mpFade');
  // dummy audio object — background music removed
  const audio = { volume: 0, muted: false, play() { return Promise.resolve(); }, pause() { }, load() { }, currentTime: 0 };
  const fill = document.getElementById('mpProgressFill');
  const counter = { textContent: '' }; // counter display removed
  const capEl = document.getElementById('mpCaption');
  const capTxt = document.getElementById('mpCaptionText');
  const ctrls = document.getElementById('mpControls');
  const endScr = document.getElementById('mpEndScreen');
  const lbTop = document.getElementById('mpLbTop');
  const lbBot = document.getElementById('mpLbBot');

  function slot(name) { return name === 'a' ? slotA : slotB; }

  /* ── OPEN / CLOSE ── */
  window.openMemoriesPlayer = function () {
    document.body.style.overflow = 'hidden';
    // شيل display:none وأعد opacity على 0 قبل أي حاجة
    overlay.style.display = '';
    overlay.style.opacity = '';
    overlay.style.pointerEvents = '';
    // تأكد إن الـ overlay بيبدأ من opacity:0 (شيل mp-open لو موجود)
    overlay.classList.remove('mp-open');

    // Spawn particles
    const pc = document.getElementById('mpParticles');
    if (!pc.hasChildNodes()) {
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'mp-particle';
        const sz = Math.random() * 3 + 2;
        p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation-duration:${Math.random() * 14 + 12}s;animation-delay:${Math.random() * 12}s;`;
        pc.appendChild(p);
      }
    }

    // Show opening screen
    const op = document.getElementById('mpOpening');
    op.style.display = '';
    op.style.opacity = '1';
    op.style.pointerEvents = 'all';
    op.classList.remove('mp-op-out');
    op.classList.add('mp-op-in');

    // Smooth fade-in: set bg first, then double-rAF to trigger transition
    overlay.classList.add('mp-bg-fade');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add('mp-open');
    }));
  };

  window.closeMemoriesPlayer = function () {
    pausePlayer();
    // امنع أي تفاعل فورًا
    overlay.style.pointerEvents = 'none';
    endScr.style.pointerEvents = 'none';
    // شيل الـ inline opacity عشان الـ CSS transition تشتغل صح
    overlay.style.opacity = '';
    // شيل mp-open عشان يبدأ الـ fade-out (opacity → 0)
    overlay.classList.remove('mp-open');
    // رجّع الـ body
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    document.body.style.pointerEvents = '';
    // استنى الـ transition (500ms) وبعدين أخفيه وعمل reset
    setTimeout(() => {
      overlay.classList.remove('mp-bg-fade');
      overlay.style.display = 'none';
      overlay.style.opacity = '';
      overlay.style.pointerEvents = '';
      resetPlayer();
    }, 520);
  };

  function resetPlayer() {
    clearTimers();
    // تأكد إن الـ overlay مخفي تمامًا بعد الإغلاق
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
    slotA.innerHTML = ''; slotB.innerHTML = '';
    slotA.classList.add('mp-active'); slotB.classList.remove('mp-active');
    active = 'a'; idx = 0; playing = false; started = false;
    currentVid = null;
    // شيل أي فيديو background اتضاف على الـ overlay
    overlay.querySelectorAll('video').forEach(v => v.remove());
    overlay.classList.remove('mp-bg-fade');
    fill.style.width = '0%';
    counter.textContent = '';
    ctrls.classList.remove('mp-ctrl-show');
    endScr.classList.remove('mp-end-show');
    endScr.style.pointerEvents = '';
    fadeEl.classList.remove('mp-black');
    capEl.classList.remove('mp-cap-show');
    document.getElementById('mpCloseBtn').style.display = '';

    // hide stage again
    const stg = document.getElementById('mpStage');
    stg.classList.remove('mp-stage-visible');

    // reset inline progress
    const inlineFill = document.getElementById('mpInlineProgressFill');
    if (inlineFill) inlineFill.style.width = '0%';

    // restore opening screen instantly
    const op = document.getElementById('mpOpening');
    op.style.display = '';
    op.style.transition = '';
    op.style.opacity = '1';
    op.style.pointerEvents = 'all';
    op.classList.remove('mp-op-out', 'mp-op-in');
    op.classList.add('mp-op-in');
    updatePlayIcon();
  }

  /* ── START ── */
  document.getElementById('mpStartBtn').addEventListener('click', function () {
    const op = document.getElementById('mpOpening');
    const stg = document.getElementById('mpStage');

    // Quick fade out the opening screen (300ms)
    op.style.transition = 'opacity 0.3s ease';
    op.style.opacity = '0';
    op.style.pointerEvents = 'none';

    setTimeout(() => {
      op.style.display = 'none';
      op.classList.remove('mp-op-in');

      // Start loading the video
      ctrls.classList.add('mp-ctrl-show');
      started = true; playing = true;
      updatePlayIcon();
      loadClip(0, false);

      // Fade in the video stage smoothly
      requestAnimationFrame(() => requestAnimationFrame(() => { stg.classList.add('mp-stage-visible'); }));
    }, 300);
  });

  /* ── REPLAY ── */
  document.getElementById('mpReplayBtn').addEventListener('click', function () {
    const stg = document.getElementById('mpStage');
    // أخفي end screen
    endScr.classList.remove('mp-end-show');
    endScr.style.pointerEvents = 'none';
    // رجّع الـ overlay لحالته الطبيعية (mp-open = pointer-events:all + opacity:1)
    overlay.style.pointerEvents = '';
    overlay.style.opacity = '';
    overlay.classList.add('mp-open');
    // ظهر الـ X تاني
    document.getElementById('mpCloseBtn').style.display = '';
    // ظهر الـ stage
    stg.classList.add('mp-stage-visible');
    document.body.style.overflow = 'hidden';
    playing = true;
    updatePlayIcon();
    idx = 0;
    loadClip(0, false);
  });

  /* ── AUDIO FADE ── */
  function fadeAudio(from, to, dur) {
    const steps = 40, step = (to - from) / steps; let i = 0;
    const id = setInterval(() => {
      audio.volume = Math.min(1, Math.max(0, audio.volume + step));
      if (++i >= steps) clearInterval(id);
    }, dur / steps);
  }

  const VIDEO_DURATION = 600; // 10 min max — syncs to actual video length via metadata

  /* ── LOAD VIDEO ── */
  function loadClip(i, seekTo) {
    clearTimers();
    slotA.innerHTML = '';
    const m = mpMedia[0];
    if (!m || !m.src) { currentVid = null; return; }

    const video = document.createElement('video');
    // تحويل الرابط تلقائياً إلى رابط مباشر للتشغيل في المتصفح
    video.src = m.src;
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;';
    video.playsInline = true;
    video.webkitPlaysInline = true;
    video.muted = muted;
    video.controls = false;

    slotA.classList.add('mp-active');
    slotA.appendChild(video);
    currentVid = video;

    video.addEventListener('loadedmetadata', () => {
      window._mpVideoDuration = video.duration;
      const timeDur = document.getElementById('mpTimeDuration');
      if (timeDur) timeDur.textContent = fmtTime(video.duration);
      if (playing) {
        video.play().catch(e => {
          console.log("Play failed:", e);
          playing = false;
          updatePlayIcon();
        });
      }
      startTimer();
    });

    video.addEventListener('ended', () => {
      endShow();
    });

    if (video.readyState >= 1) {
      window._mpVideoDuration = video.duration;
      if (playing) {
        video.play().catch(() => { });
      }
      startTimer();
    }

    showCaption(m.caption || '');
  }

  function getDur() { return window._mpVideoDuration || VIDEO_DURATION; }

  /* ── TIMER — synced to video currentTime ── */
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function startTimer() {
    clearInterval(progTimer);
    const inlineFill = document.getElementById('mpInlineProgressFill');
    const timeCur = document.getElementById('mpTimeCurrent');
    const timeDur = document.getElementById('mpTimeDuration');
    progTimer = setInterval(() => {
      const v = currentVid;
      if (!v) return;
      const dur = getDur();
      const pct = (v.currentTime / dur) * 100;
      fill.style.width = Math.min(pct, 100) + '%';
      if (inlineFill) inlineFill.style.width = Math.min(pct, 100) + '%';
      if (timeCur) timeCur.textContent = fmtTime(v.currentTime);
      if (timeDur) timeDur.textContent = fmtTime(dur);
    }, 60);
  }

  function clearTimers() {
    clearTimeout(clipTimer);
    clearInterval(progTimer);
    fill.style.width = '0%';
  }

  /* ── PLAYBACK ── */
  function pausePlayer() {
    playing = false;
    if (currentVid) currentVid.pause();
    updatePlayIcon();
  }
  function playPlayer() {
    playing = true;
    if (currentVid) currentVid.play().catch(() => { });
    startTimer();
    updatePlayIcon();
  }
  function togglePlay() { playing ? pausePlayer() : playPlayer(); }

  function updatePlayIcon() {
    document.getElementById('mpPlayIcon').style.display = playing ? 'none' : '';
    document.getElementById('mpPauseIcon').style.display = playing ? '' : 'none';
  }

  /* ── CAPTION ── */
  function showCaption(text) {
    if (!text) { capEl.classList.remove('mp-cap-show'); return; }
    capTxt.textContent = text;
    capEl.classList.add('mp-cap-show');
    setTimeout(() => capEl.classList.remove('mp-cap-show'), 3500);
  }

  /* ── END ── */
  function endShow() {
    clearTimers(); playing = false;
    updatePlayIcon();

    const stg = document.getElementById('mpStage');
    fadeEl.classList.add('mp-black');

    setTimeout(() => {
      stg.classList.remove('mp-stage-visible');
      endScr.classList.add('mp-end-show');
      fadeEl.classList.remove('mp-black');
      document.getElementById('mpCloseBtn').style.display = 'none';
    }, 1200);

    // اسمح للـ end screen يستقبل clicks بس، الباقي للـ overlay يتجمد
    overlay.classList.remove('mp-open');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'none';
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    endScr.style.pointerEvents = 'all';
  }

  /* ── WIRING ── */
  document.getElementById('mpPlayBtn').addEventListener('click', togglePlay);

  // Prev = -3s, Next = +3s
  document.getElementById('mpPrevBtn').addEventListener('click', () => {
    if (!started || !currentVid) return;
    currentVid.currentTime = Math.max(0, currentVid.currentTime - 3);
  });
  document.getElementById('mpNextBtn').addEventListener('click', () => {
    if (!started || !currentVid) return;
    currentVid.currentTime = Math.min(getDur(), currentVid.currentTime + 3);
  });

  document.getElementById('mpMuteBtn').addEventListener('click', () => {
    muted = !muted;
    if (currentVid) currentVid.muted = muted;

    const btn = document.getElementById('mpMuteBtn');
    const soundOn = document.getElementById('mpSoundOn');
    const soundOff = document.getElementById('mpSoundOff');

    document.getElementById('mpSoundOn').style.display = muted ? 'none' : '';

    if (muted) {
      soundOff.classList.remove('x-draw');
      soundOff.style.display = '';
      void soundOff.offsetWidth;
      soundOff.classList.add('x-draw');
    } else {
      soundOff.style.display = 'none';
      soundOff.classList.remove('x-draw');
    }

    btn.classList.remove('speaker-bounce');
    void btn.offsetWidth;
    btn.classList.add('speaker-bounce');
    btn.addEventListener('animationend', () => btn.classList.remove('speaker-bounce'), { once: true });
  });

  // Timeline click = seek
  document.getElementById('mpProgressTrack').addEventListener('click', e => {
    if (!started || !currentVid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    currentVid.currentTime = Math.min(pct * getDur(), getDur());
    fill.style.width = (pct * 100) + '%';
  });

  const inlineTrack = document.getElementById('mpInlineProgress');
  if (inlineTrack) {
    let isDragging = false;

    function seekTo(e) {
      if (!started || !currentVid) return;
      const rect = inlineTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      currentVid.currentTime = pct * getDur();
      const inlineFill = document.getElementById('mpInlineProgressFill');
      if (inlineFill) inlineFill.style.width = (pct * 100) + '%';
      fill.style.width = (pct * 100) + '%';
    }

    inlineTrack.addEventListener('mousedown', e => { isDragging = true; seekTo(e); });
    inlineTrack.addEventListener('touchstart', e => { isDragging = true; seekTo(e); }, { passive: true });
    document.addEventListener('mousemove', e => { if (isDragging) seekTo(e); });
    document.addEventListener('touchmove', e => { if (isDragging) seekTo(e); }, { passive: true });
    document.addEventListener('mouseup', () => { isDragging = false; });
    document.addEventListener('touchend', () => { isDragging = false; });
    inlineTrack.addEventListener('click', seekTo);
  }

  const fsBtn = document.getElementById('mpFullscreenBtn');
  const fsEnter = document.getElementById('mpFsEnter');
  const fsExit = document.getElementById('mpFsExit');
  const shrinkBtn = document.getElementById('mpShrinkBtn');
  const isMobile = () => window.innerWidth <= 700;

  function setMobileFull(on) {
    const card = document.getElementById('mpVideoCard');
    if (on) {
      overlay.classList.add('mp-mobile-full');
      if (shrinkBtn) shrinkBtn.classList.add('mp-shrink-visible');
      if (card) {
        card.classList.remove('mp-fs-exiting');
        card.classList.add('mp-fs-entering');
        card.addEventListener('animationend', () => card.classList.remove('mp-fs-entering'), { once: true });
      }
    } else {
      overlay.classList.remove('mp-mobile-full');
      if (shrinkBtn) shrinkBtn.classList.remove('mp-shrink-visible');
      if (card) {
        card.classList.remove('mp-fs-entering');
        card.classList.add('mp-fs-exiting');
        card.addEventListener('animationend', () => card.classList.remove('mp-fs-exiting'), { once: true });
      }
    }
  }

  function setPcTall(on) {
    const card = document.getElementById('mpVideoCard');
    if (on) {
      overlay.classList.add('mp-pc-tall');
      if (card) {
        card.classList.remove('mp-fs-exiting');
        card.classList.add('mp-fs-entering');
        card.addEventListener('animationend', () => card.classList.remove('mp-fs-entering'), { once: true });
      }
    } else {
      overlay.classList.remove('mp-pc-tall');
      if (card) {
        card.classList.remove('mp-fs-entering');
        card.classList.add('mp-fs-exiting');
        card.addEventListener('animationend', () => card.classList.remove('mp-fs-exiting'), { once: true });
      }
    }
  }

  function updateFsIcon() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    if (fsEnter) fsEnter.style.display = isFs ? 'none' : '';
    if (fsExit) fsExit.style.display = isFs ? '' : 'none';
  }
  document.addEventListener('fullscreenchange', updateFsIcon);
  document.addEventListener('webkitfullscreenchange', updateFsIcon);

  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (isMobile()) {
        const isAlreadyFull = overlay.classList.contains('mp-mobile-full');
        setMobileFull(!isAlreadyFull);
      } else {
        const isPcTall = overlay.classList.contains('mp-pc-tall');
        setPcTall(!isPcTall);
        if (fsEnter) fsEnter.style.display = isPcTall ? '' : 'none';
        if (fsExit) fsExit.style.display = isPcTall ? 'none' : '';
      }
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      if (isMobile()) {
        setMobileFull(false);
        if (fsEnter) fsEnter.style.display = '';
        if (fsExit) fsExit.style.display = 'none';
      } else {
        setPcTall(false);
        if (fsEnter) fsEnter.style.display = '';
        if (fsExit) fsExit.style.display = 'none';
      }
    });
  }

  let hideTimer;
  overlay.addEventListener('mousemove', showCtrls);
  overlay.addEventListener('touchstart', showCtrls, { passive: true });
  function showCtrls() {
    if (!started) return;
    ctrls.classList.add('mp-ctrl-show');
    clearTimeout(hideTimer);
  }

  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('mp-open') || !started) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight' || e.key === 'l') { if (currentVid) currentVid.currentTime = Math.min(getDur(), currentVid.currentTime + 3); }
    if (e.key === 'ArrowLeft' || e.key === 'j') { if (currentVid) currentVid.currentTime = Math.max(0, currentVid.currentTime - 3); }
    if (e.key === 'Escape') closeMemoriesPlayer();
    if (e.key === 'm') document.getElementById('mpMuteBtn').click();
  });
})();
  

// ══════ Main ══════
// ── Custom Cursor ──
const cursorGlow = document.getElementById('cursorGlow');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let cursorRAFPending = false;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (!cursorRAFPending) {
    cursorRAFPending = true;
    requestAnimationFrame(() => {
      cursorGlow.style.left = `${mouseX}px`;
      cursorGlow.style.top = `${mouseY}px`;
      cursorRAFPending = false;
    });
  }
}, { passive: true });

// ── Particles ──
const container = document.getElementById('particles');
for (let i = 0; i < 10; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = Math.random() * 3 + 2;
  p.style.cssText = `
  width: ${size}px; height: ${size}px;
  left: ${Math.random() * 100}%;
  animation-duration: ${Math.random() * 14 + 12}s;
  animation-delay: ${Math.random() * 12}s;
`;
  container.appendChild(p);
}

// ── Navigation ──
function showSection(id, btn, fromMobile) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('visible'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('visible');
  if (btn) btn.classList.add('active');
  // sync the other nav
  if (fromMobile) {
    document.querySelectorAll('.nav-btn').forEach(b => {
      const t = b.getAttribute('data-text') || b.textContent.trim();
      if (b.onclick && b.onclick.toString().includes("'" + id + "'")) b.classList.add('active');
    });
  } else {
    const mob = document.getElementById('mob-' + id);
    if (mob) mob.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  const icon = document.querySelector('.ig-hanging-icon');
  if (icon) {
    if (id === 'contact') {
      icon.style.display = 'block';
      icon.classList.remove('visible', 'swinging');
      void icon.offsetWidth;
      icon.classList.add('visible');
      icon.addEventListener('animationend', () => {
        icon.classList.remove('visible');
        icon.classList.add('swinging');
      }, { once: true });
    } else {
      icon.style.display = 'none';
      icon.classList.remove('visible', 'swinging');
    }
  }
}

// ── Go Home (B.L.S logo click) ──
function goHome() {
  const section = document.getElementById('owners');
  const firstBtn = document.querySelector('.nav-btn');
  // Switch to owners section first
  showSection('owners', firstBtn);
  // Force re-trigger the fadeUp animation
  section.style.animation = 'none';
  void section.offsetHeight; // reflow
  section.style.animation = '';
}

// ── Generate Junior Cards ──
const juniors = [
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null },
  { name: "Name", img: null }
];

const instaIconSVG = `<svg class="insta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>`;

const grid = document.getElementById('juniorsGrid');

juniors.forEach(s => {
  const card = document.createElement('div');
  card.className = 'card junior-card';

  if (s.img) {
    card.innerHTML = `
    <img class="card-photo" src="${s.img}" alt="${s.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="eager" decoding="sync">
    <div class="card-photo-placeholder" style="display:none"></div>
    <div class="card-body">
      <div class="card-name">Name</div>
    </div>`;
  } else {
    card.innerHTML = `
    <div class="card-photo-placeholder"></div>
    <div class="card-body">
      <div class="card-name">Name</div>
    </div>`;
  }

  grid.appendChild(card);
});

// ── Cinematic Credits ──
const creditNames = [
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name",
  "Name", "Name", "Name", "Name"
];

const namesContainer = document.getElementById('namesContainer');
creditNames.forEach((name, i) => {
  const el = document.createElement('div');
  el.style.cssText = `
  font-family: 'Cairo', sans-serif;
  font-size: clamp(19px, 3.5vw, 24px);
  font-weight: 668;
  color: rgba(255,255,255,0.78);
  letter-spacing: 1px;
  padding: 0.55rem 0;
  text-shadow: 0 0 18px rgba(255,255,255,0.12);
  transition: color 0.3s;
  white-space: nowrap;
  overflow: visible;
`;
  el.textContent = name;
  namesContainer.appendChild(el);
});

let creditsRAF = null;
let creditsActive = false;
let creditsParticleInterval = null;

function openCredits() {
  const overlay = document.getElementById('creditsOverlay');
  const titleScreen = document.getElementById('creditsTitleScreen');
  const scroller = document.getElementById('creditsScroller');
  const closeBtn = document.getElementById('creditsClose');
  const track = document.getElementById('creditsTrack');

  track.style.transition = 'none';
  track.style.transform = 'translateX(-50%) translateY(0px)';
  creditsActive = true;

  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  setTimeout(() => {
    titleScreen.style.opacity = '1';
    closeBtn.style.opacity = '1';
  }, 300);

  setTimeout(() => {
    titleScreen.style.opacity = '0';
    scroller.style.opacity = '1';
    startScrolling(track);
  }, 1900);

  spawnCreditsParticles();
  spawnCreditsOrbs();
}

function spawnCreditsParticles() {
  const container = document.getElementById('creditsParticles');
  container.innerHTML = '';
  if (creditsParticleInterval) clearInterval(creditsParticleInterval);

  // Limit particle count — mobile gets fewer to stay at 120fps
  const isMobile = window.innerWidth < 768;
  const maxParticles = isMobile ? 4 : 8;
  let particleCount = 0;

  function makeParticle() {
    if (particleCount >= maxParticles) return;
    particleCount++;
    const p = document.createElement('div');
    const size = Math.random() * 3 + 2;
    const duration = Math.random() * 14 + 10;
    const left = Math.random() * 100;
    p.style.cssText = `
    position:absolute;
    width:${size}px; height:${size}px;
    border-radius:50%;
    background:rgba(200,180,180,0.07);
    left:${left}%;
    bottom:-10px;
    animation: float ${duration}s linear forwards;
    pointer-events:none;
    will-change:transform;
  `;
    container.appendChild(p);
    setTimeout(() => { p.remove(); particleCount--; }, duration * 1000);
  }

  for (let i = 0; i < (isMobile ? 3 : 5); i++) makeParticle();
  creditsParticleInterval = setInterval(() => {
    if (creditsActive) makeParticle();
    else clearInterval(creditsParticleInterval);
  }, isMobile ? 3500 : 2000);
}

function startScrolling(track) {
  const viewH = window.innerHeight;
  const endCard = track.querySelector('[data-end-card]');
  let stopAt;
  if (endCard) {
    stopAt = endCard.offsetTop - viewH * 0.15;
  } else {
    stopAt = track.scrollHeight - viewH * 0.5;
  }
  const duration = stopAt / 2.4 / 60;
  track.style.transition = `transform ${duration}s linear`;
  track.style.transform = `translateX(-50%) translateY(-${stopAt}px)`;
  track.addEventListener('transitionend', () => {
    const scroller = document.getElementById('creditsScroller');
    scroller.style.transition = 'opacity 0.4s ease';
    scroller.style.opacity = '0';

    setTimeout(() => {
      const logoScreen = document.getElementById('creditsLogoScreen');
      logoScreen.style.transition = 'opacity 0.5s ease';
      logoScreen.style.opacity = '1';

      setTimeout(() => {
        logoScreen.style.transition = 'opacity 0.9s ease';
        logoScreen.style.opacity = '0';
        setTimeout(closeCredits, 950);
      }, 2400);
    }, 400);
  }, { once: true });
}

function closeCredits() {
  creditsActive = false;
  if (creditsRAF) cancelAnimationFrame(creditsRAF);
  if (creditsParticleInterval) clearInterval(creditsParticleInterval);
  const overlay = document.getElementById('creditsOverlay');
  const titleScreen = document.getElementById('creditsTitleScreen');
  const scroller = document.getElementById('creditsScroller');
  const logoScreen = document.getElementById('creditsLogoScreen');
  overlay.style.transition = 'opacity 0.8s ease';
  overlay.style.opacity = '0';
  titleScreen.style.opacity = '0';
  scroller.style.opacity = '0';
  if (logoScreen) logoScreen.style.opacity = '0';
  document.body.style.overflow = '';
  setTimeout(() => { overlay.style.display = 'none'; }, 850);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCredits();
});

// ── Fix fadeup glitch on hover ──
document.querySelectorAll('.fadeup-card').forEach(card => {
  card.addEventListener('animationend', () => {
    card.classList.add('animated');
  });
});

// ── Season Switcher ──
function switchSeason(num, btn) {
  document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.season-content').forEach(c => c.classList.remove('visible'));
  btn.classList.add('active');
  document.getElementById('season' + num).classList.add('visible');
  const slider = document.getElementById('seasonSlider');
  if (num === 2) {
    slider.classList.add('s2');
  } else {
    slider.classList.remove('s2');
  }
}

// ── Nav scroll state ──
const topNav = document.querySelector('.top-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 30) {
    topNav.classList.add('scrolled');
  } else {
    topNav.classList.remove('scrolled');
  }
}, { passive: true });

// ── Credits Orbs ──
function spawnCreditsOrbs() { /* removed — static gradient handles atmosphere */ }

// ── Team Pages Logic ──
// ── Team data ──
const teamData = {
  'Team 1': { logo: null, accentColor: 'rgba(201,168,76,0.45)', accentBg: 'rgba(201,168,76,0.06)', accentGlow: 'rgba(201,168,76,0.8)', accentShadow: 'rgba(255,240,180,0.08)' },
  'Team 2': { logo: null, accentColor: 'rgba(220,80,80,0.45)', accentBg: 'rgba(220,80,80,0.06)', accentGlow: 'rgba(220,80,80,0.8)', accentShadow: 'rgba(255,180,180,0.08)' },
  'Team 3': { logo: null, accentColor: 'rgba(180,180,180,0.45)', accentBg: 'rgba(180,180,180,0.06)', accentGlow: 'rgba(200,200,200,0.8)', accentShadow: 'rgba(230,230,230,0.08)' },
  'Team 4': { logo: null, accentColor: 'rgba(80,160,220,0.45)', accentBg: 'rgba(80,160,220,0.06)', accentGlow: 'rgba(120,190,240,0.8)', accentShadow: 'rgba(160,210,255,0.08)' },
};

const termPlayers = {
  'Team 1_1': [
    { pos: 'LW', name: 'Name', photo: null, insta: '' },
    { pos: 'RW', name: 'Name', photo: null, insta: '' },
    { pos: 'CM', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
    { pos: 'GK', name: 'Name', photo: null, insta: '' },
  ],
  'Team 1_1_bench': [
    { pos: 'CF', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
  ],
  'Team 2_1': [
    { pos: 'ST', name: 'Name', photo: null, insta: '' },
    { pos: 'LW', name: 'Name', photo: null, insta: '' },
    { pos: 'RW', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
    { pos: 'GK', name: 'Name', photo: null, insta: '' },
  ],
  'Team 2_1_bench': [
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
  ],
  'Team 3_1': [
    { pos: 'RW', name: 'Name', photo: null },
    { pos: 'CM', name: 'Name', photo: null },
    { pos: 'CB', name: 'Name', photo: null },
    { pos: 'LB', name: 'Name', photo: null },
    { pos: 'GK', name: 'Name', photo: null },
  ],
  'Team 1_2': [
    { pos: 'LW', name: 'Name', photo: null, insta: '' },
    { pos: 'CM', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
    { pos: 'GK', name: 'Name', photo: null, insta: '' },
  ],
  'Team 1_2_bench': [
    { pos: 'CF', name: 'Name', photo: null, insta: '' },
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
  ],
  'Team 2_2': [
    { pos: 'LW', name: 'Name', photo: null, insta: '' },
    { pos: 'RW', name: 'Name', photo: null, insta: '' },
    { pos: 'RB', name: 'Name', photo: null, insta: '' },
    { pos: 'LB', name: 'Name', photo: null, insta: '' },
    { pos: 'GK', name: 'Name', photo: null, insta: '' },
  ],
  'Team 2_2_bench': [
    { pos: 'CB', name: 'Name', photo: null, insta: '' },
  ],
  'Team 4_2': [
    { pos: 'LW', name: 'Name', photo: null },
    { pos: 'RW', name: 'Name', photo: null },
    { pos: 'CM', name: 'Name', photo: null },
    { pos: 'CB', name: 'Name', photo: null },
    { pos: 'GK', name: 'Name', photo: null },
  ],
};

const termLabels = { 1: 'First Term', 2: 'Second Term' };
const placeLabels = {
  'Team 1_1': '1st Place ', 'Team 2_1': '2nd Place ', 'Team 3_1': '3rd Place ',
  'Team 2_2': '1st Place ', 'Team 1_2': '2nd Place ', 'Team 4_2': '3rd Place ',
};

const playerProfiles = {
  'Name': {
    photo: null,
    pos: 'POS',
    ovr: 50,
    skills: [
      { label: 'Pace', value: 50 },
      { label: 'Dribbling', value: 50 },
      { label: 'Shooting', value: 50 },
      { label: 'Passing', value: 50 },
      { label: 'Physical', value: 50 },
      { label: 'Defending', value: 50 },
    ],
    bio: '',
  },
};

function getSkillColor(val) {
  const v = Math.max(0, Math.min(100, val));
  let r, g, b;
  if (v >= 50) {
    // 100 = #008000 rgb(0,128,0)  →  50 = slight yellow rgb(180,160,0)
    const t = (v - 50) / 50;
    r = Math.round(180 - 180 * t);
    g = Math.round(160 - (160 - 128) * t);
    b = 0;
  } else {
    // below 50 = red rgb(200,0,0)
    r = 200; g = 0; b = 0;
  }
  return `rgb(${r},${g},${b})`;
}
function openPlayerProfile(playerName, pos) {
  const overlay = document.getElementById('playerProfileOverlay');
  const content = document.getElementById('playerProfileContent');
  const p = Object.assign({}, playerProfiles['Name'], pos ? { pos: pos } : {});

  if (!p) return;

  const overall = p.ovr !== undefined ? p.ovr : Math.round(p.skills.reduce((s, sk) => s + sk.value, 0) / p.skills.length);
  const overallColor = getSkillColor(overall);

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;align-items:center;gap:0;padding-bottom:2.5rem;">

    <!-- Player Card Header -->
    <style>
      .player-hero-card {
        position: relative;
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
        padding-top: 2rem;
      }
      .player-card-inner {
        position: relative;
        border-radius: 24px;
        overflow: hidden;
        background: linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.2) 100%);
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        padding: 2rem 1.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }
      .player-card-inner::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, ${overallColor}cc, transparent);
      }


      .player-info-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        width: 100%;
        margin-top: 1.25rem;
      }
      .ovr-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }
      .ovr-num {
        font-family: 'Cairo', sans-serif;
        font-size: 58px;
        font-weight: 900;
        color: #fff;
        line-height: 1;
        text-shadow: 0 0 14px rgba(255,255,255,0.35);
      }
      .ovr-label {
        font-size: 10px;
        letter-spacing: 5px;
        color: rgba(255,255,255,0.5);
        font-weight: 800;
        text-transform: uppercase;
        font-family: 'Cairo', sans-serif;
        margin-top: 2px;
      }
      .name-divider-block {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        flex: 1;
      }
      .card-player-name {
        font-family: 'Cairo', sans-serif;
        font-size: clamp(18px, 4vw, 26px);
        font-weight: 900;
        color: #fff;
        letter-spacing: 0.5px;
        line-height: 1.1;
      }
      .card-name-line {
        width: 40px;
        height: 2px;
        border-radius: 2px;
        background: #8b1a35;
        margin-top: 2px;
        box-shadow: 0 0 8px #8b1a3588;
      }
    </style>

    <div class="player-hero-card">
      <div class="player-card-inner" style="position:relative;">
        <!-- pos top left -->
        <div style="position:absolute;top:1rem;left:1.2rem;z-index:10;">
          <span style="font-family:'Cairo',sans-serif;font-size:clamp(28px,5vw,38px);font-weight:900;color:#fff;line-height:1;letter-spacing:1px;text-shadow:0 0 14px rgba(255,255,255,0.35);">${p.pos}</span>
        </div>

        <!-- photo circle -->
        <style>
          .photo-circle-wrap {
            position: relative;
            width: 160px;
            height: 160px;
            cursor: pointer;
          }
          .photo-glow-blob {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 220px; height: 220px;
            border-radius: 50%;
            background: radial-gradient(circle, #7b0d2288 0%, #5c091844 45%, transparent 72%);
            filter: blur(22px);
            z-index: 0;
            pointer-events: none;
            transition: transform 0.4s ease, filter 0.4s ease;
          }
          .photo-circle-wrap:hover .photo-glow-blob {
            transform: translate(-50%, -50%) scale(1.3);
            filter: blur(28px);
          }
          .photo-circle-img {
            position: relative;
            z-index: 2;
            width: 160px; height: 160px;
            border-radius: 50%;
            object-fit: cover;
            object-position: center top;
            border: 3.2px solid #8b1a35;
            box-shadow:
              0 0 0 4px #7b0d2244,
              0 0 18px #8b1a3599,
              0 0 40px #6b122855;
            transition: box-shadow 0.4s ease;
          }
          .photo-circle-wrap:hover .photo-circle-img {
            box-shadow:
              0 0 0 4px #8b1a3566,
              0 0 28px #8b1a35bb,
              0 0 60px #6b122877;
          }
        </style>

        <div class="photo-circle-wrap">
          <div class="photo-glow-blob"></div>
          ${p.photo
      ? `<img class="photo-circle-img" src="${p.photo}" alt="${playerName}" loading="eager" decoding="sync">`
      : `<div style="position:relative;z-index:2;width:160px;height:160px;border-radius:50%;background:rgba(107,18,40,0.4);border:3.2px solid ${overallColor};display:flex;align-items:center;justify-content:center;font-size:54px;"></div>`
    }
              
        </div>

        <!-- name + OVR row -->
        <div class="player-info-row">
          <div class="ovr-block">
            <span class="ovr-num">${overall}</span>
            <span class="ovr-label">OVR</span>
          </div>
          <div style="width:1px;height:50px;background:rgba(255,255,255,0.1);"></div>
          <div class="name-divider-block">
            <span class="card-player-name">${playerName}</span>
            <div class="card-name-line"></div>
          </div>
        </div>

      </div>
    </div>

    <!-- Skills Circles -->
    <style>
      .skills-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        width: 100%;
        max-width: 480px;
        padding: 0 1rem;
        margin-left: auto;
        margin-right: auto;
      }
      @media (min-width: 500px) {
        .skills-grid {
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          max-width: 560px;
        }
      }
      .skill-circle-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .skill-circle-svg {
        transform: rotate(-90deg);
        overflow: visible;
      }
      .skill-track-circle {
        fill: none;
        stroke: rgba(255,255,255,0.06);
        stroke-width: 4;
      }
      .skill-arc {
        fill: none;
        stroke-width: 4;
        stroke-linecap: round;
        transition: stroke-dashoffset 1s cubic-bezier(.4,0,.2,1);
      }
      .skill-num {
        font-family: 'Cairo', sans-serif;
        font-weight: 900;
        font-size: 16px;
        dominant-baseline: central;
        text-anchor: middle;
      }
      .skill-name {
        font-family: 'Cairo', sans-serif;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.45);
        text-align: center;
      }
    </style>

    <div style="width:100%;max-width:560px;padding:0 1.25rem 0;margin-top:0.25rem;margin-left:auto;margin-right:auto;">
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);margin-bottom:1.75rem;"></div>
    </div>

    <div class="skills-grid" style="margin:0 auto;">
      ${p.skills.map(sk => {
      const col = getSkillColor(sk.value);
      const R = 28;
      const circ = +(2 * Math.PI * R).toFixed(2);
      const offset = +(circ - (sk.value / 100) * circ).toFixed(2);
      return `
        <div class="skill-circle-wrap">
          <div style="position:relative;width:76px;height:76px;">
            <!-- outer glow ring -->
            <div style="position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,${col}22 0%,transparent 70%);pointer-events:none;"></div>
            <svg class="skill-circle-svg" viewBox="0 0 72 72" width="76" height="76" style="overflow:visible;">
              <defs>
                <filter id="glow-${sk.label}" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <!-- track -->
              <circle class="skill-track-circle" cx="36" cy="36" r="${R}"/>
              <!-- arc -->
              <circle class="skill-arc"
                cx="36" cy="36" r="${R}"
                stroke="${col}"
                stroke-dasharray="${circ}"
                stroke-dashoffset="${offset}"
                filter="url(#glow-${sk.label})"
                style="filter:drop-shadow(0 0 5px ${col}) drop-shadow(0 0 10px ${col}88);"
              />
              <!-- number -->
              <text class="skill-num" x="36" y="36"
                transform="rotate(90,36,36)"
                fill="${col}"
                style="filter:drop-shadow(0 0 6px ${col}cc);"
              >${sk.value}</text>
            </svg>
          </div>
          <span class="skill-name">${sk.label}</span>
        </div>`;
    }).join('')}
    </div>

    ${p.bio ? `
    <div style="width:100%;max-width:480px;margin-top:2rem;padding:1.25rem 1.5rem;background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:16px;">
      <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:0.5rem;font-family:'Cairo',sans-serif;">About</div>
      <div style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;font-style:italic;">${p.bio}</div>
    </div>` : ''}

  </div>
`;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePlayerProfile() {
  const overlay = document.getElementById('playerProfileOverlay');
  overlay.classList.remove('active');
  overlay.classList.add('closing');
  document.body.style.overflow = '';
  setTimeout(() => overlay.classList.remove('closing'), 340);
}

function buildTeamCards(players, t) {
  const lastIdx = players.length - 1;
  return players.map((p, i) => `
  <div class="card founder-card${i === lastIdx && players.length % 2 !== 0 ? ' castillo-last' : ''}"
    style="border-color:${t.accentColor}; background:${t.accentBg}; box-shadow:inset 0 1px 0 ${t.accentShadow}, 0 8px 32px rgba(0,0,0,0.4)">
    ${p.photo
      ? `<img class="card-photo" src="${p.photo}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="eager" decoding="sync">
         <div class="card-photo-placeholder" style="display:none"></div>`
      : `<div class="card-photo-placeholder"></div>`
    }
    <div class="card-body">
      <div style="font-size:clamp(10px,2.5vw,15px);letter-spacing:0.5px;color:${t.accentGlow};text-transform:uppercase;margin-bottom:4px;font-family:'Cairo',sans-serif;font-weight:900;">${p.pos}</div>
      <div class="card-name">Name</div>
      ${p.insta !== undefined ? `
      <button class="card-insta-btn" onclick="event.stopPropagation();openPlayerProfile('${p.name}','${p.pos}')" style="cursor:pointer;">
        <svg class="insta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Profile
      </button>
      <a class="card-insta-btn">
        <svg class="insta-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
        Instagram
      </a>` : ''}
    </div>
  </div>
`).join('');
}

function openTeamPage(teamName, term) {
  const overlay = document.getElementById('teamPageOverlay');
  const title = document.getElementById('teamPageTitle');
  const content = document.getElementById('teamPageContent');

  title.textContent = teamName;

  const key = `${teamName}_${term}`;
  const t = teamData[teamName] || teamData['Team 2'];
  const players = termPlayers[key] || [];
  const placeLabel = placeLabels[key] || '';
  const termLabel = termLabels[term] || '';

  const benchKey = `${teamName}_${term}_bench`;
  const benchPlayers = termPlayers[benchKey] || [];
  const hasBench = benchPlayers.length > 0;

  content.innerHTML = `
  <div style="text-align:center; margin-bottom:2rem;">
    <div style="width:150px;height:150px;margin:0 auto;"></div>
    <h2 style="font-family:'Cairo',sans-serif; font-size:clamp(24px,4vw,36px); font-weight:800; font-style:normal; color:var(--white); margin-top:0.75rem;">${teamName}</h2>
    <div style="font-size:11px;letter-spacing:4px;color:${t.accentGlow};text-transform:uppercase;margin-top:4px;">${termLabel} · ${placeLabel}</div>
  </div>
  <style>
    .team-players-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      max-width: 1100px;
      margin: 0 auto;
    }
    @media (max-width: 700px) {
      .team-players-grid { grid-template-columns: repeat(2, 1fr); }
      .team-players-grid .castillo-last {
        grid-column: 1 / -1;
        max-width: calc(50% - 8px);
        margin: 0 auto;
      }
    }
  </style>
  <div class="team-players-grid">
    ${buildTeamCards(players, t)}
  </div>
  ${hasBench ? `
    <div style="display:flex;justify-content:center;margin-top:2.5rem;">
      <button class="bench-sheet-trigger" onclick="openBenchSheet('${teamName}', ${term})" style="
        display:inline-flex;align-items:center;gap:8px;
        padding:10px 28px;
        border-radius:50px;
        font-family:'Cairo',sans-serif;
        font-size:13px;
        font-weight:800;
        letter-spacing:2px;
        text-transform:uppercase;
        color:rgba(255,255,255,0.65);
        border:0.5px solid rgba(200,160,160,0.22);
        background:rgba(200,160,160,0.06);
        cursor:pointer;
        transition:all 0.28s cubic-bezier(.4,0,.2,1);
        box-shadow:0 4px 20px rgba(0,0,0,0.18);
      "
      onmouseover="this.style.background='rgba(200,160,160,0.14)';this.style.borderColor='rgba(200,160,160,0.45)';this.style.color='rgba(255,255,255,0.9)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px rgba(0,0,0,0.28)';"
      onmouseout="this.style.background='rgba(200,160,160,0.06)';this.style.borderColor='rgba(200,160,160,0.22)';this.style.color='rgba(255,255,255,0.65)';this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.18)';"
      >
        <svg style="width:14px;height:14px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;" viewBox="0 0 16 16"><path d="M2 5h12M4 9h8M6 13h4"/></svg>
        Bench
      </button>
    </div>
  ` : ''}
`;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeTeamPage() {
  const overlay = document.getElementById('teamPageOverlay');
  overlay.classList.remove('active');
  overlay.classList.add('closing');
  document.body.style.overflow = '';
  setTimeout(() => {
    overlay.classList.remove('closing');
  }, 340);
}
  

// ══════ Ripple ══════
document.querySelectorAll('.mp-ripple-btn').forEach(btn => {
  btn.addEventListener('pointerdown', function (e) {
    const r = document.createElement('span');
    r.className = 'mp-ripple';
    r.style.left = e.offsetX + 'px';
    r.style.top = e.offsetY + 'px';
    this.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });
});

// Skip ±3 seconds on the active video
function skipVideo(sec) {
  const activeSlot = document.querySelector('.mp-slot.mp-active');
  if (!activeSlot) return;
  const vid = activeSlot.querySelector('video');
  if (vid) {
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + sec));
  }
}

// Re-trigger button entrance animation each time player opens
const _origOpenMP = window.openMemoriesPlayer;
window.openMemoriesPlayer = function () {
  if (_origOpenMP) _origOpenMP.apply(this, arguments);
  setTimeout(() => {
    document.querySelectorAll('#mpInlineButtons .mp-btn').forEach(btn => {
      btn.style.animation = 'none';
      btn.offsetHeight;
      btn.style.animation = '';
    });
  }, 300);
};
  

// ══════ Bench Sheet ══════
let _benchSheetOpen = false;

function openBenchSheet(teamName, term) {
  const key = teamName + '_' + term + '_bench';
  const t = teamData[teamName] || teamData['Team 2'];
  const bench = termPlayers[key] || [];

  const cardsHtml = bench.map(p => `
  <div class="card founder-card"
    style="border-color:${t.accentColor};background:${t.accentBg};box-shadow:inset 0 1px 0 ${t.accentShadow},0 8px 32px rgba(0,0,0,0.4);">
    ${p.photo
      ? `<img class="card-photo" src="${p.photo}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="eager" decoding="sync">
         <div class="card-photo-placeholder" style="display:none"></div>`
      : `<div class="card-photo-placeholder"></div>`
    }
    <div class="card-body">
      <div style="font-size:clamp(10px,2.5vw,13px);letter-spacing:0.5px;color:${t.accentGlow};text-transform:uppercase;margin-bottom:4px;font-family:'Cairo',sans-serif;font-weight:900;">${p.pos}</div>
      <div class="card-name">Name</div>
      ${p.insta !== undefined ? `
      <button class="card-insta-btn" onclick="event.stopPropagation();closeBenchSheet();setTimeout(()=>openPlayerProfile('${p.name}','${p.pos}'),80)" style="cursor:pointer;">
        <svg class="insta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Profile
      </button>
      <a class="card-insta-btn" onclick="event.stopPropagation()">
        <svg class="insta-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
        Instagram
      </a>` : ''}
    </div>
  </div>
`).join('');

  document.getElementById('benchSheetCards').innerHTML = cardsHtml;

  const backdrop = document.getElementById('benchSheetBackdrop');
  const sheet = document.getElementById('benchSheet');

  backdrop.style.display = 'block';
  sheet.style.display = 'block';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('active');
    sheet.classList.add('active');
  }));
  _benchSheetOpen = true;
}

function closeBenchSheet() {
  if (!_benchSheetOpen) return;
  const backdrop = document.getElementById('benchSheetBackdrop');
  const sheet = document.getElementById('benchSheet');
  backdrop.classList.remove('active');
  sheet.classList.remove('active');
  setTimeout(() => {
    backdrop.style.display = 'none';
    sheet.style.display = 'none';
  }, 420);
  _benchSheetOpen = false;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _benchSheetOpen) closeBenchSheet();
});
  

