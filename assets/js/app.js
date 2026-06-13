import { fmtTime } from './timer.js';
import * as Comp from './competition.js';
import { calcReport, renderReport, exportPNG, initRosataZoom } from './report.js';
import { scoreAt, targetRingsSvg, BULLET_RADIUS_MM, TARGET_OUTER_RADIUS_MM, AIMING_DISK_RADIUS_MM } from './target.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = document.getElementById('app');

function init() {
    initThemeToggle();
    Comp.loadState();
    setupGlobalOverlays();
    setupDropdowns();
    registerServiceWorker();
    navigate();
    window.addEventListener('hashchange', navigate);
    window.addEventListener('beforeunload', () => {
        const phase = Comp.getPhase();
        if (phase === 'trial') Comp.pauseTrialTimer();
        if (phase === 'competition') Comp.pauseCompTimer();
    });
}

// ── Dropdown menus (shared between home nav and admin table) ──────────────────
function closeMenus() {
    document.querySelectorAll('.action-dropdown').forEach(d => d.classList.add('hidden'));
}
function toggleActionMenu(btn) {
    const dd = btn.nextElementSibling;
    const wasHidden = dd.classList.contains('hidden');
    closeMenus();
    if (wasHidden) dd.classList.remove('hidden');
}
function setupDropdowns() {
    window.toggleActionMenu = toggleActionMenu;
    window.closeMenus = closeMenus;
    document.addEventListener('click', e => {
        if (!e.target.closest('.action-menu')) closeMenus();
    });
}

function navigate() {
    const hash = location.hash.replace('#', '') || 'home';
    const [page, qs] = hash.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs ?? ''));

    const phase = Comp.getPhase();
    if ((phase === 'trial' || phase === 'competition') && page !== 'training' && page !== 'report') {
        location.hash = '#training';
        return;
    }

    document.body.classList.toggle('p10-training', page === 'training');

    switch (page) {
        case 'home':    renderHome();   break;
        case 'setup':   renderSetup();  break;
        case 'training': renderTraining(); break;
        case 'report':  renderReportPage(params); break;
        case 'sessions': renderSessions(); break;
        case 'session': renderSessionReport(params); break;
        case 'login':   renderLogin();  break;
        case 'admin':   renderAdmin();  break;
        case 'settings': renderSettings(); break;
        default: renderHome(); break;
    }
}

function go(hash) { location.hash = '#' + hash; }

// ── Theme ─────────────────────────────────────────────────────────────────────
function effectiveTheme() {
    const stored = localStorage.getItem('p10_theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function initThemeToggle() {
    applyTheme(effectiveTheme());
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    syncThemeBtn(btn);
    btn.addEventListener('click', () => {
        const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        localStorage.setItem('p10_theme', next);
        applyTheme(next);
        syncThemeBtn(btn);
    });
}

function syncThemeBtn(btn) {
    // Icon itself comes from .theme-btn::before in CSS (auto-updates with [data-theme])
    const dark = effectiveTheme() === 'dark';
    btn.title = dark ? 'Tema chiaro' : 'Tema scuro';
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(url, body = null, method = null) {
    const opts = {
        method: method ?? (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
}

// ── Global overlays ───────────────────────────────────────────────────────────
function setupGlobalOverlays() {
    document.getElementById('btn-confirm').addEventListener('click', () => Comp.doConfirm());
    document.getElementById('btn-cancel').addEventListener('click', () => Comp.cancelPending());
    document.getElementById('btn-resume').addEventListener('click', resumeFromPause);
    document.getElementById('btn-abort-confirm').addEventListener('click', doAbort);
    document.getElementById('btn-abort-cancel').addEventListener('click', () => Comp.hideOverlay('overlay-abort'));
}

// ── Home ──────────────────────────────────────────────────────────────────────
function renderHome() {
    const user = window.APP_USER;
    const menuItems = user
        ? [
            `<button onclick="closeMenus();go('sessions')">Archivio sessioni</button>`,
            user.is_admin ? `<button onclick="closeMenus();go('admin')">Gestione utenti</button>` : '',
            `<button onclick="closeMenus();go('settings')">Impostazioni</button>`,
          ].filter(Boolean)
        : [`<button onclick="closeMenus();go('login')">Accedi</button>`];

    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <div class="nav">
                    <span class="nav-logo">⊙ P10</span>
                    <span class="nav-spacer"></span>
                    <div class="action-menu">
                        <button class="nav-link" onclick="toggleActionMenu(this)" style="font-size:1.3rem;padding:4px 10px">☰</button>
                        <div class="action-dropdown hidden">
                            ${menuItems.join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="page-body">
            <div class="home-hero">
                <div class="home-logo">
                    <img class="home-target" src="/assets/icons/issf.svg" alt="ISSF">
                </div>
                <h1 class="home-title">P10</h1>
                <p class="home-sub">Simulatore gare pistola 10 metri</p>
                <button class="btn btn-primary btn-lg btn-full" onclick="go('setup')">
                    Inizia allenamento
                </button>
            </div>
        </div>
    </div>`;
    bindGo();
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function renderSetup() {
    const saved = Comp.getConfig();
    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('home')">← Indietro</button>
                <h2 class="page-title">Configurazione gara</h2>
            </div>
        </div>
        <div class="page-body">
            <div class="form-group">
                <div class="form-label">Tipo bersaglio</div>
                <div class="radio-group">
                    <div class="radio-card">
                        <input type="radio" name="target" id="t-paper" value="paper"
                               ${saved.targetType === 'paper' ? 'checked' : ''}>
                        <label for="t-paper">
                            <span class="rc-icon">📄</span>
                            <span class="rc-title">Cartaceo</span>
                            <span class="rc-sub">1h 30min</span>
                        </label>
                    </div>
                    <div class="radio-card">
                        <input type="radio" name="target" id="t-elec" value="electronic"
                               ${saved.targetType === 'electronic' ? 'checked' : ''}>
                        <label for="t-elec">
                            <span class="rc-icon">⚡</span>
                            <span class="rc-title">Elettronico</span>
                            <span class="rc-sub">1h 15min</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <div class="form-label">Modalità di punteggio</div>
                <div class="radio-group">
                    <div class="radio-card">
                        <input type="radio" name="scoremode" id="s-point" value="point"
                               onchange="toggleHandedness(false)"
                               ${saved.scoreMode !== 'group' ? 'checked' : ''}>
                        <label for="s-point">
                            <span class="rc-icon">🔢</span>
                            <span class="rc-title">A punto</span>
                            <span class="rc-sub">Tocca il punteggio</span>
                        </label>
                    </div>
                    <div class="radio-card">
                        <input type="radio" name="scoremode" id="s-group" value="group"
                               onchange="toggleHandedness(true)"
                               ${saved.scoreMode === 'group' ? 'checked' : ''}>
                        <label for="s-group">
                            <span class="rc-icon">🎯</span>
                            <span class="rc-title">A rosata</span>
                            <span class="rc-sub">Trascina sul bersaglio</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="form-group ${saved.scoreMode === 'group' ? '' : 'hidden'}" id="handedness-group">
                <div class="form-label">Mano</div>
                <div class="radio-group">
                    <div class="radio-card">
                        <input type="radio" name="handedness" id="h-right" value="right"
                               ${saved.handedness !== 'left' ? 'checked' : ''}>
                        <label for="h-right">
                            <span class="rc-icon">🫱</span>
                            <span class="rc-title">Destro</span>
                            <span class="rc-sub">Lente a destra del dito</span>
                        </label>
                    </div>
                    <div class="radio-card">
                        <input type="radio" name="handedness" id="h-left" value="left"
                               ${saved.handedness === 'left' ? 'checked' : ''}>
                        <label for="h-left">
                            <span class="rc-icon">🫲</span>
                            <span class="rc-title">Mancino</span>
                            <span class="rc-sub">Lente a sinistra del dito</span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <div class="form-label">Opzioni</div>
                <div class="card" style="padding:0 16px">
                    <div class="toggle-row">
                        <div>
                            <div class="toggle-label">Mostra somme parziali</div>
                            <div class="toggle-desc">Totale serie e punteggio corrente</div>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" id="opt-partials"
                                   ${saved.showPartials ? 'checked' : ''}>
                            <span class="toggle-track"></span>
                        </label>
                    </div>
                    <div class="toggle-row">
                        <div>
                            <div class="toggle-label">Conferma automatica</div>
                            <div class="toggle-desc">Registra il colpo dopo N secondi</div>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" id="opt-auto" onchange="toggleAutoConf(this.checked)"
                                   ${saved.confirmMode === 'auto' ? 'checked' : ''}>
                            <span class="toggle-track"></span>
                        </label>
                    </div>
                    <div class="toggle-row ${saved.confirmMode !== 'auto' ? 'hidden' : ''}" id="auto-conf-row">
                        <div style="flex:1; min-width:0">
                            <div class="toggle-label">Timeout: <span id="timeout-val">${saved.autoConfirmMs / 1000}s</span></div>
                        </div>
                        <input type="range" class="slider" id="opt-timeout"
                               style="flex:0 0 110px"
                               min="1" max="10" step="0.5"
                               value="${saved.autoConfirmMs / 1000}"
                               oninput="document.getElementById('timeout-val').textContent = this.value + 's'">
                    </div>
                </div>
            </div>
        </div>
        <div class="page-footer">
            <button class="btn btn-primary btn-lg btn-full" onclick="startSession()">
                Inizia →
            </button>
        </div>
    </div>`;

    window.toggleAutoConf = (v) => {
        document.getElementById('auto-conf-row').classList.toggle('hidden', !v);
    };

    window.toggleHandedness = (v) => {
        document.getElementById('handedness-group').classList.toggle('hidden', !v);
    };

    window.startSession = async () => {
        const targetType = document.querySelector('input[name="target"]:checked')?.value || 'paper';
        const scoreMode = document.querySelector('input[name="scoremode"]:checked')?.value || 'point';
        const handedness = document.querySelector('input[name="handedness"]:checked')?.value || 'right';
        const showPartials = document.getElementById('opt-partials').checked;
        const confirmMode = document.getElementById('opt-auto').checked ? 'auto' : 'manual';
        const autoConfirmMs = Math.round(parseFloat(document.getElementById('opt-timeout').value) * 1000);

        Comp.setupSession({ targetType, scoreMode, handedness, showPartials, confirmMode, autoConfirmMs });
        const synced = await Comp.syncSessionCreate();
        if (window.APP_USER && !synced) {
            alert('⚠ Sessione non salvata sul server (controlla la console per i dettagli). La gara prosegue in modalità locale.');
        }
        go('training');
    };
    bindGo();
}

// ── Training ──────────────────────────────────────────────────────────────────
let trainingUnloaded = false;

function renderTraining() {
    trainingUnloaded = false;
    const phase = Comp.getPhase();

    if (phase === 'completed' || phase === 'aborted') {
        go('report');
        return;
    }

    const isComp = phase === 'competition';
    const config = Comp.getConfig();
    const partials = config.showPartials;
    const usesGroupInput = config.scoreMode === 'group';

    app.innerHTML = `
    <div class="training-page">
        <div class="training-top">
            <div class="timer-row">
                <span class="timer-display" id="timer-display">--:--</span>
                <span class="phase-badge ${isComp ? 'competition' : ''}" id="phase-badge">
                    ${isComp ? 'GARA' : 'PROVA'}
                </span>
            </div>
            ${isComp ? `
            <div class="progress-row">
                <span class="progress-item">Colpi: <strong id="shot-count">0</strong>/60</span>
                <span class="progress-sep">·</span>
                <span class="progress-item">Serie: <strong id="series-num">1</strong>/6</span>
                <span class="progress-sep">·</span>
                <span class="progress-item">Rimanenti: <strong id="remaining">60</strong></span>
            </div>
            ${partials ? `
            <div class="series-partials" id="series-partials">
                ${[1,2,3,4,5,6].map(s => `
                <div class="sp-box sp-empty" id="sp-${s}">
                    <div class="sp-label">S${s}</div>
                    <div class="sp-score">–</div>
                </div>`).join('')}
            </div>` : ''}
            <div class="controls-row">
                <button class="btn-pause" id="btn-pause" onclick="togglePause()">⏸ Pausa</button>
            </div>` : `
            <div class="controls-row" style="margin-top:6px">
                <button class="btn-pause" id="btn-pause" onclick="togglePause()">⏸ Pausa</button>
            </div>`}
        </div>

        <div class="shot-area">
            ${usesGroupInput ? renderTargetInputMarkup() : renderShotGridMarkup()}
        </div>

        <div class="training-bottom">
            ${!isComp
                ? `<button class="btn-start-comp" onclick="doStartComp()">▶ Inizia Gara</button>`
                : `<button class="btn-abort" onclick="showAbortDialog()">■ Interrompi gara</button>`}
        </div>
    </div>`;

    window.handleShot = handleShot;
    window.togglePause = togglePause;
    window.doStartComp = doStartComp;
    window.showAbortDialog = showAbortDialog;

    if (usesGroupInput) initTargetInput();

    if (isComp) {
        updateCompUI();
        Comp.restoreCompTimer(
            (elapsed, remaining) => {
                if (trainingUnloaded) return;
                document.getElementById('timer-display').textContent = fmtTime(remaining);
                if (remaining < 60000) {
                    document.getElementById('timer-display').classList.add('warning');
                }
            },
            () => { if (!trainingUnloaded) onCompTimeUp(); }
        );
    } else {
        Comp.startTrialTimer(
            (elapsed, remaining) => {
                if (trainingUnloaded) return;
                const el = document.getElementById('timer-display');
                if (el) el.textContent = fmtTime(remaining);
            },
            () => {
                if (trainingUnloaded) return;
                const el = document.getElementById('timer-display');
                if (el) { el.textContent = '00:00'; el.classList.add('warning'); }
            }
        );
    }
}

function renderShotGridMarkup() {
    return `
            <div class="shot-grid" id="shot-grid">
                <div class="shot-row">
                    <button class="shot-btn" data-value="9" onclick="handleShot(9, false)">9</button>
                </div>
                <div class="shot-row">
                    <button class="shot-btn" data-value="10" onclick="handleShot(10, false)">10</button>
                    <button class="shot-btn mouche" data-value="10" onclick="handleShot(10, true)">M</button>
                </div>
                <div class="shot-row">
                    <button class="shot-btn" data-value="8" onclick="handleShot(8, false)">8</button>
                </div>
                <div class="shot-row">
                    <button class="shot-btn" data-value="7" onclick="handleShot(7, false)">7</button>
                    <button class="shot-btn" data-value="6" onclick="handleShot(6, false)">6</button>
                </div>
                <div class="shot-row">
                    <button class="shot-btn" data-value="5" onclick="handleShot(5, false)">5</button>
                    <button class="shot-btn" data-value="4" onclick="handleShot(4, false)">4</button>
                    <button class="shot-btn" data-value="3" onclick="handleShot(3, false)">3</button>
                </div>
                <div class="shot-row">
                    <button class="shot-btn" data-value="2" onclick="handleShot(2, false)">2</button>
                    <button class="shot-btn" data-value="1" onclick="handleShot(1, false)">1</button>
                    <button class="shot-btn" data-value="0" onclick="handleShot(0, false)">0</button>
                </div>
            </div>`;
}

function renderTargetInputMarkup() {
    const R = TARGET_OUTER_RADIUS_MM;
    return `
            <div class="target-input" id="target-input">
                <div class="target-zoom-toggle">
                    <button type="button" class="zoom-btn active" id="zoom-1x" data-zoom="1">1x</button>
                    <button type="button" class="zoom-btn" id="zoom-2x" data-zoom="2">2x</button>
                </div>
                <svg id="target-svg" class="target-svg"
                     viewBox="${-R} ${-R} ${2 * R} ${2 * R}" preserveAspectRatio="xMidYMid meet">
                    <g id="target-rings"></g>
                    <g id="target-persisted-shots" class="persisted-shots"></g>
                    <circle id="live-marker" class="live-marker hidden" r="${BULLET_RADIUS_MM}" />
                </svg>
                <div class="target-hint">Tieni premuto e trascina il colpo sul bersaglio</div>
            </div>
            <div class="loupe hidden" id="loupe">
                <svg id="loupe-svg" class="loupe-svg" viewBox="0 0 64 64">
                    <g id="loupe-pan">
                        <g id="loupe-rings"></g>
                        <g id="loupe-persisted-shots" class="persisted-shots"></g>
                        <circle id="loupe-marker" class="loupe-marker" r="${BULLET_RADIUS_MM}" />
                    </g>
                </svg>
                <div class="loupe-score" id="loupe-score">–</div>
            </div>`;
}

const LOUPE_FOV_MM = 30; // campo visivo della lente in mm

// Preset di zoom per il bersaglio principale: 1x = intero bersaglio, 2x = solo disco nero (anelli 7-10 + mouche)
const ZOOM_PRESETS = {
    1: TARGET_OUTER_RADIUS_MM,
    2: AIMING_DISK_RADIUS_MM,
};

function initTargetInput() {
    const svg = document.getElementById('target-svg');
    const ringsG = document.getElementById('target-rings');
    const loupeRingsG = document.getElementById('loupe-rings');
    const marker = document.getElementById('live-marker');
    const loupe = document.getElementById('loupe');
    const loupeSvg = document.getElementById('loupe-svg');
    const loupePan = document.getElementById('loupe-pan');
    const loupeMarker = document.getElementById('loupe-marker');
    const loupeScore = document.getElementById('loupe-score');
    const zoomBtns = document.querySelectorAll('.zoom-btn');
    if (!svg || !ringsG || !marker || !loupe) return;

    const loupeOnLeft = Comp.getConfig().handedness === 'left';

    const ringsMarkup = targetRingsSvg();
    ringsG.innerHTML = ringsMarkup;
    loupeRingsG.innerHTML = ringsMarkup;

    refreshTargetPersistedShots();

    zoomBtns.forEach(btn => btn.addEventListener('click', () => {
        const level = Number(btn.dataset.zoom);
        const r = ZOOM_PRESETS[level] || TARGET_OUTER_RADIUS_MM;
        svg.setAttribute('viewBox', `${-r} ${-r} ${2 * r} ${2 * r}`);
        zoomBtns.forEach(b => b.classList.toggle('active', b === btn));
    }));

    let dragging = false;

    function clientToTargetMm(clientX, clientY) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const local = pt.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
    }

    function positionLoupe(clientX, clientY, xMm, yMm) {
        const w = loupe.offsetWidth || 140;
        const h = loupe.offsetHeight || 140;
        let left = loupeOnLeft ? (clientX - w - 28) : (clientX + 28);
        let top = clientY - h - 28;
        left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
        top = Math.min(Math.max(8, top), window.innerHeight - h - 8);
        loupe.style.left = left + 'px';
        loupe.style.top = top + 'px';

        const vb = loupeSvg.viewBox.baseVal;
        const scale = vb.width / LOUPE_FOV_MM;
        loupePan.setAttribute('transform',
            `translate(${vb.width / 2 - xMm * scale}, ${vb.height / 2 - yMm * scale}) scale(${scale})`);
    }

    function updateScoreLabel(value, isMouche) {
        loupeScore.textContent = isMouche ? 'M' : String(value);
        loupeScore.style.color = isMouche ? 'var(--mouche)' : '';
    }

    function updateDrag(clientX, clientY) {
        const { x, y } = clientToTargetMm(clientX, clientY);
        marker.setAttribute('transform', `translate(${x},${y})`);
        loupeMarker.setAttribute('transform', `translate(${x},${y})`);
        const { value, isMouche } = scoreAt(x, y);
        positionLoupe(clientX, clientY, x, y);
        updateScoreLabel(value, isMouche);
        return { x, y, value, isMouche };
    }

    function onPointerDown(e) {
        const phase = Comp.getPhase();
        if (phase !== 'trial' && phase !== 'competition') return;
        dragging = true;
        svg.setPointerCapture(e.pointerId);
        marker.classList.remove('hidden');
        loupe.classList.remove('hidden');
        e.preventDefault();
        updateDrag(e.clientX, e.clientY);
    }

    function onPointerMove(e) {
        if (!dragging) return;
        e.preventDefault();
        updateDrag(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
        if (!dragging) return;
        dragging = false;
        try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
        marker.classList.add('hidden');
        loupe.classList.add('hidden');
        const { x, y, value, isMouche } = updateDrag(e.clientX, e.clientY);
        handleShot(value, isMouche, x, y);
    }

    function onPointerCancel() {
        dragging = false;
        marker.classList.add('hidden');
        loupe.classList.add('hidden');
    }

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerCancel);
}

function handleShot(value, isMouche, x = null, y = null) {
    const phase = Comp.getPhase();
    if (phase !== 'trial' && phase !== 'competition') return;

    Comp.beginConfirm(value, isMouche,
        () => {
            if (phase === 'trial') {
                Comp.registerTrialShot(value, isMouche, x, y);
                refreshTargetPersistedShots();
            } else {
                Comp.registerCompShot(value, isMouche, x, y);
                const newPhase = Comp.getPhase();
                if (newPhase === 'completed') {
                    trainingUnloaded = true;
                    go('report');
                } else {
                    updateCompUI();
                    refreshTargetPersistedShots();
                }
            }
        },
        null
    );
}

// Mostra in trasparenza, sul bersaglio, i colpi già sparati nella serie in corso
// (solo con "somme parziali" attive e modalità "a rosata"); il bersaglio si svuota
// da solo al cambio serie perché il filtro segue la serie dell'ultimo colpo.
function refreshTargetPersistedShots() {
    const config = Comp.getConfig();
    if (config.scoreMode !== 'group') return;
    const g = document.getElementById('target-persisted-shots');
    const loupeG = document.getElementById('loupe-persisted-shots');
    if (!g) return;

    const phase = Comp.getPhase();
    const dot = sh => `<circle cx="${sh.x}" cy="${sh.y}" r="${BULLET_RADIUS_MM}" fill="var(--accent)" />`;
    const setMarkup = markup => {
        g.innerHTML = markup;
        if (loupeG) loupeG.innerHTML = markup;
    };

    if (phase === 'trial') {
        // In prova i colpi restano sempre visibili in trasparenza, indipendentemente
        // da "mostra somme parziali" (quell'opzione riguarda solo la gara).
        setMarkup(Comp.getTrialShots()
            .filter(sh => sh.x != null && sh.y != null)
            .map(dot)
            .join(''));
        return;
    }

    if (phase !== 'competition' || !config.showPartials) { setMarkup(''); return; }
    const shots = Comp.getCompShots();
    if (shots.length === 0) { setMarkup(''); return; }
    const curSeries = shots[shots.length - 1].seriesNumber;
    setMarkup(shots
        .filter(sh => sh.seriesNumber === curSeries && sh.x != null && sh.y != null)
        .map(dot)
        .join(''));
}

function updateCompUI() {
    const count = Comp.getShotCount();
    const rem = Comp.getRemaining();
    const series = Comp.getSeriesNum();
    document.getElementById('shot-count').textContent = count;
    document.getElementById('series-num').textContent = series;
    document.getElementById('remaining').textContent = rem;

    const config = Comp.getConfig();
    if (config.showPartials) {
        const shots = Comp.getCompShots();
        for (let s = 1; s <= 6; s++) {
            const box = document.getElementById(`sp-${s}`);
            if (!box) continue;
            const serShots = shots.filter(sh => sh.seriesNumber === s);
            const scoreEl = box.querySelector('.sp-score');
            if (serShots.length === 0) {
                box.className = 'sp-box sp-empty';
                scoreEl.textContent = '–';
            } else {
                const total   = serShots.reduce((a, sh) => a + sh.value, 0);
                const mouches = serShots.filter(sh => sh.isMouche).length;
                const done    = serShots.length === 10;
                box.className = `sp-box ${done ? 'sp-done' : 'sp-current'}`;
                scoreEl.innerHTML = `${total}<span class="sp-mouches"> (${mouches})</span>`;
            }
        }
    }
}

async function doStartComp() {
    Comp.pauseTrialTimer();
    await Comp.startCompetition();
    // Call renderTraining directly: go('training') would be a no-op because
    // the hash is already #training (we're transitioning from trial to competition).
    renderTraining();
}

function onCompTimeUp() {
    // Time expired: fill remaining shots with 0 and end
    Comp.abortCompetition().then(() => {
        trainingUnloaded = true;
        go('report');
    });
}

let paused = false;

function togglePause() {
    const phase = Comp.getPhase();
    if (!paused) {
        paused = true;
        if (phase === 'trial') Comp.pauseTrialTimer();
        else Comp.pauseCompTimer();
        Comp.showOverlay('overlay-pause');
    }
}

function resumeFromPause() {
    paused = false;
    Comp.hideOverlay('overlay-pause');
    const phase = Comp.getPhase();
    if (phase === 'trial') Comp.resumeTrialTimer();
    else Comp.resumeCompTimer();
}

function showAbortDialog() {
    const rem = Comp.getRemaining();
    document.getElementById('abort-msg').textContent =
        `I ${rem} colp${rem === 1 ? 'o rimasto' : 'i rimanenti'} verranno registrati come 0.`;
    Comp.showOverlay('overlay-abort');
}

async function doAbort() {
    Comp.hideOverlay('overlay-abort');
    await Comp.abortCompetition();
    trainingUnloaded = true;
    go('report');
}

// ── Report (current session) ───────────────────────────────────────────────────
function renderReportPage() {
    const phase = Comp.getPhase();
    if (phase !== 'completed' && phase !== 'aborted') { go('training'); return; }
    const report = calcReport(Comp.getCompShots(), Comp.getTrialShots(), Comp.getConfig());
    const isAborted = Comp.getPhase() === 'aborted';

    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <h2 class="page-title">Report Gara</h2>
                <button class="btn btn-ghost btn-sm" onclick="newSession()">Home</button>
            </div>
        </div>
        <div class="page-body">
            ${renderReport(report, { isAborted })}
            <div class="report-actions">
                <button class="btn btn-outline" onclick="exportPNG('report-card')">⬇ Salva PNG</button>
            </div>
            ${window.APP_USER ? `<div class="mt-16"><button class="btn btn-ghost btn-full" onclick="go('sessions')">Vai all'archivio →</button></div>` : ''}
        </div>
    </div>`;

    window.newSession = () => { Comp.clearState(); go('home'); };
    window.exportPNG = exportPNG;
    initRosataZoom();
    bindGo();
}

// ── Session report (from history) ────────────────────────────────────────────
async function renderSessionReport(params) {
    if (!window.APP_USER) { go('login'); return; }
    const id = params.id;
    if (!id) { go('sessions'); return; }

    app.innerHTML = `<div class="page"><div class="page-body"><div class="spinner"></div></div></div>`;

    const res = await apiFetch(`/api/session_get.php?id=${id}`);
    if (!res.ok) { go('sessions'); return; }

    const session = res.data;
    const compShots = session.shots.filter(s => s.phase === 'competition').map(s => ({
        value: s.value, isMouche: !!s.is_mouche, x: s.x, y: s.y,
        seriesNumber: s.series_number, shotInSeries: s.shot_in_series,
        shotTotal: s.shot_total, elapsedMs: s.elapsed_ms, phase: 'competition',
    }));
    const trialShots = session.shots.filter(s => s.phase === 'trial').map(s => ({
        value: s.value, isMouche: !!s.is_mouche, x: s.x, y: s.y, phase: 'trial', elapsedMs: s.elapsed_ms,
    }));
    const config = { targetType: session.target_type, scoreMode: session.score_mode };
    const report = calcReport(compShots, trialShots, config);
    const isAborted = session.aborted == 1;

    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('sessions')">← Archivio</button>
                <h2 class="page-title">Report Gara</h2>
            </div>
        </div>
        <div class="page-body">
            ${renderReport(report, { isAborted, sessionDate: session.started_at })}
            <div class="report-actions">
                <button class="btn btn-outline" onclick="exportPNG('report-card')">⬇ Salva PNG</button>
            </div>
            <div class="mt-16">
                <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">Elimina sessione</button>
            </div>
        </div>
    </div>`;

    window.exportPNG = exportPNG;
    initRosataZoom();
    window.deleteSession = async (sid) => {
        if (!confirm('Eliminare questa sessione?')) return;
        const r = await apiFetch('/api/session_delete.php', { id: sid });
        if (r.ok) go('sessions');
    };
    bindGo();
}

// ── Sessions list ─────────────────────────────────────────────────────────────
async function renderSessions() {
    if (!window.APP_USER) { go('login'); return; }
    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('home')">← Home</button>
                <h2 class="page-title">Archivio sessioni</h2>
            </div>
        </div>
        <div class="page-body"><div class="spinner"></div></div>
    </div>`;

    const res = await apiFetch('/api/sessions_list.php');
    if (!res.ok) { app.querySelector('.page-body').innerHTML = '<p class="text-muted">Errore caricamento</p>'; return; }

    const sessions = res.data;
    const bodyEl = app.querySelector('.page-body');

    if (sessions.length === 0) {
        bodyEl.innerHTML = '<p class="text-muted text-center">Nessuna sessione registrata.</p>';
        return;
    }

    bodyEl.innerHTML = sessions.map(s => {
        const date = new Date(s.started_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
        const target = s.target_type === 'paper' ? 'Cartaceo' : 'Elettronico';
        const statusIcon = s.aborted == 1 ? '⚠ ' : (s.status === 'completed' ? '✓ ' : '');
        const score = s.total_score ?? '–';
        return `
        <div class="session-item" onclick="go('session?id=${s.id}')">
            <div class="session-info">
                <div class="session-date">${statusIcon}${date}</div>
                <div class="session-meta">${target} · ${s.shot_count ?? 0} colpi</div>
            </div>
            <div class="session-score">${score}</div>
        </div>`;
    }).join('');
    bindGo();
}

// ── Login ─────────────────────────────────────────────────────────────────────
function renderLogin() {
    if (window.APP_USER) { go('home'); return; }
    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('home')">← Home</button>
                <h2 class="page-title">Accedi</h2>
            </div>
        </div>
        <div class="page-body">
            <div id="login-error" class="alert alert-error hidden"></div>
            <div class="form-group">
                <label class="form-label" for="username">Username</label>
                <input class="form-control" type="text" id="username" autocomplete="username"
                       autocapitalize="none" placeholder="username">
            </div>
            <div class="form-group">
                <label class="form-label" for="password">Password</label>
                <input class="form-control" type="password" id="password" autocomplete="current-password"
                       placeholder="••••••">
            </div>
        </div>
        <div class="page-footer">
            <button class="btn btn-primary btn-lg btn-full" onclick="doLogin()">Accedi</button>
        </div>
    </div>`;

    window.doLogin = async () => {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const errEl = document.getElementById('login-error');
        errEl.classList.add('hidden');
        if (!username || !password) {
            errEl.textContent = 'Inserisci username e password';
            errEl.classList.remove('hidden');
            return;
        }
        const res = await apiFetch('/api/login.php', { username, password });
        if (res.ok) {
            window.APP_USER = res.data;
            go('home');
        } else {
            errEl.textContent = res.error || 'Credenziali non valide';
            errEl.classList.remove('hidden');
        }
    };

    document.getElementById('password').addEventListener('keydown', e => {
        if (e.key === 'Enter') window.doLogin();
    });
    bindGo();
}

// ── Settings ──────────────────────────────────────────────────────────────────
function renderSettings() {
    if (!window.APP_USER) { go('login'); return; }
    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('home')">← Home</button>
                <h2 class="page-title">Impostazioni</h2>
            </div>
        </div>
        <div class="page-body">
            <div class="settings-section">
                <h3>Account</h3>
                <div class="card" style="margin-bottom:12px">
                    <p><strong>${window.APP_USER.username}</strong>${window.APP_USER.is_admin ? ' <span class="badge badge-admin">Admin</span>' : ''}</p>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:12px">Cambia password</h3>
                    <div id="pw-msg"></div>
                    <div class="form-group">
                        <input class="form-control" type="password" id="pw-current"
                               placeholder="Password attuale" autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <input class="form-control" type="password" id="pw-new"
                               placeholder="Nuova password (min 4 caratteri)" autocomplete="new-password">
                    </div>
                    <button class="btn btn-primary btn-full" onclick="changePassword()">Salva nuova password</button>
                </div>
                <div class="mt-16">
                    <button class="btn btn-ghost btn-full" onclick="doLogout()">Esci dall'account</button>
                </div>
            </div>
        </div>
    </div>`;

    window.doLogout = async () => {
        await apiFetch('/api/logout.php', {});
        window.APP_USER = null;
        go('home');
    };
    window.changePassword = async () => {
        const current = document.getElementById('pw-current').value;
        const newPw   = document.getElementById('pw-new').value;
        const msg     = document.getElementById('pw-msg');
        msg.innerHTML = '';
        if (!current || !newPw) {
            msg.innerHTML = '<div class="alert alert-error">Compila entrambi i campi</div>';
            return;
        }
        const res = await apiFetch('/api/change_password.php', {
            current_password: current,
            new_password: newPw,
        });
        if (res.ok) {
            msg.innerHTML = '<div class="alert alert-success">Password aggiornata</div>';
            document.getElementById('pw-current').value = '';
            document.getElementById('pw-new').value = '';
        } else {
            msg.innerHTML = `<div class="alert alert-error">${res.error}</div>`;
        }
    };
    bindGo();
}

// ── Admin ─────────────────────────────────────────────────────────────────────
async function renderAdmin() {
    if (!window.APP_USER?.is_admin) { go('home'); return; }
    app.innerHTML = `
    <div class="page">
        <div class="page-header">
            <div class="page-header-inner">
                <button class="btn btn-ghost btn-sm" onclick="go('home')">← Home</button>
                <h2 class="page-title">Gestione utenti</h2>
            </div>
        </div>
        <div class="page-body">
            <div id="admin-msg"></div>
            <div class="card" style="margin-bottom:20px">
                <h3 style="margin-bottom:14px">Crea utente</h3>
                <div class="form-group">
                    <input class="form-control" id="new-username" placeholder="Username" autocapitalize="none">
                </div>
                <div class="form-group">
                    <input class="form-control" type="password" id="new-password" placeholder="Password (min 4 caratteri)">
                </div>
                <div class="toggle-row" style="padding:8px 0">
                    <span class="toggle-label">Admin</span>
                    <label class="toggle">
                        <input type="checkbox" id="new-admin">
                        <span class="toggle-track"></span>
                    </label>
                </div>
                <button class="btn btn-primary btn-full" onclick="createUser()" style="margin-top:8px">Crea utente</button>
            </div>
            <div id="user-list"><div class="spinner"></div></div>
        </div>
    </div>`;

    window.createUser = async () => {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;
        const is_admin = document.getElementById('new-admin').checked;
        const msg = document.getElementById('admin-msg');
        const res = await apiFetch('/api/admin_users.php', { action: 'create', username, password, is_admin });
        if (res.ok) {
            msg.innerHTML = '<div class="alert alert-success">Utente creato!</div>';
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            loadUserList();
        } else {
            msg.innerHTML = `<div class="alert alert-error">${res.error}</div>`;
        }
    };

    window.deleteUser = async (id, name) => {
        if (!confirm(`Eliminare l'utente "${name}"?`)) return;
        const res = await apiFetch('/api/admin_users.php', { action: 'delete', id });
        if (res.ok) loadUserList();
    };

    window.resetPassword = async (id, name) => {
        const pw = prompt(`Nuova password per "${name}" (min 4 caratteri):`);
        if (pw === null) return;
        if (pw.length < 4) { alert('Password troppo corta (min 4 caratteri)'); return; }
        const res = await apiFetch('/api/admin_users.php', { action: 'change_password', id, password: pw });
        const msg = document.getElementById('admin-msg');
        if (res.ok) {
            msg.innerHTML = `<div class="alert alert-success">Password di "${name}" aggiornata</div>`;
        } else {
            msg.innerHTML = `<div class="alert alert-error">${res.error}</div>`;
        }
    };

    await loadUserList();
    bindGo();
}

async function loadUserList() {
    const res = await apiFetch('/api/admin_users.php');
    const el = document.getElementById('user-list');
    if (!res.ok || !el) return;
    const users = res.data;
    el.innerHTML = `
    <table class="user-table">
        <thead><tr>
            <th>Username</th><th>Ruolo</th><th>Creato</th><th></th>
        </tr></thead>
        <tbody>
            ${users.map(u => `
            <tr>
                <td><strong>${escHtml(u.username)}</strong></td>
                <td><span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'Admin' : 'Utente'}</span></td>
                <td style="font-size:.8rem;color:var(--text-muted)">${new Date(u.created_at).toLocaleDateString('it-IT')}</td>
                <td>${u.username !== window.APP_USER.username ? `
                    <div class="action-menu">
                        <button class="btn btn-ghost btn-sm" onclick="toggleActionMenu(this)">⋮</button>
                        <div class="action-dropdown hidden">
                            <button onclick="closeMenus();resetPassword(${u.id},'${escHtml(u.username)}')">Reset password</button>
                            <button class="danger" onclick="closeMenus();deleteUser(${u.id},'${escHtml(u.username)}')">Elimina</button>
                        </div>
                    </div>` : '<span class="text-muted" style="font-size:.8rem">Tu</span>'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function bindGo() {
    window.go = go;
}

function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
