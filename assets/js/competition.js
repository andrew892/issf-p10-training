import { Timer, fmtTime } from './timer.js';

const STATE_KEY = 'p10_state';
const TRIAL_MS  = 15 * 60 * 1000;
const COMP_PAPER_MS = 90 * 60 * 1000;
const COMP_ELEC_MS  = 75 * 60 * 1000;
const TOTAL_SHOTS   = 60;
const SERIES_SIZE   = 10;

let state = null;
let trialTimer = null;
let compTimer  = null;
let pendingShot = null;
let confirmTimeout = null;
let confirmInterval = null;

// ── State persistence ────────────────────────────────────────────────────────
function defaultState() {
    return {
        version: 1,
        phase: 'idle',
        sessionId: null,
        config: {
            targetType: 'paper',
            showPartials: true,
            confirmMode: 'manual',
            autoConfirmMs: 3000,
            scoreMode: 'point',
            handedness: 'right',
        },
        trialShots: [],
        compShots: [],
        trialTimerState: null,
        compTimerState: null,
    };
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
            state = JSON.parse(raw);
        }
    } catch (_) {}
    if (!state) state = defaultState();
    return state;
}

export function getState() { return state; }

export function clearState() {
    state = defaultState();
    localStorage.removeItem(STATE_KEY);
    destroyTimers();
}

function saveState() {
    if (trialTimer) state.trialTimerState = trialTimer.serialize();
    if (compTimer)  state.compTimerState  = compTimer.serialize();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function destroyTimers() {
    trialTimer?.stop();
    compTimer?.stop();
    trialTimer = null;
    compTimer  = null;
}

// ── Shot helpers ─────────────────────────────────────────────────────────────
function shotCount()  { return state.compShots.length; }
function remaining()  { return TOTAL_SHOTS - shotCount(); }
function seriesNum()  { return Math.floor(shotCount() / SERIES_SIZE) + 1; }
function shotInSer()  { return (shotCount() % SERIES_SIZE) + 1; }

// ── Setup & start ────────────────────────────────────────────────────────────
export function setupSession(config) {
    state = defaultState();
    state.config = { ...state.config, ...config };
    state.phase = 'trial';
    saveState();
}

export async function syncSessionCreate() {
    if (!window.APP_USER) return false;
    try {
        const res = await fetch('/api/session_create.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_type:     state.config.targetType,
                show_partials:   state.config.showPartials,
                confirm_mode:    state.config.confirmMode,
                auto_confirm_ms: state.config.autoConfirmMs,
                score_mode:      state.config.scoreMode,
            }),
        });
        const data = await res.json();
        if (data.ok) {
            state.sessionId = data.data.session_id;
            saveState();
            return true;
        }
        console.warn('session_create error:', data.error, '(HTTP', res.status + ')');
    } catch (e) {
        console.warn('session_create fetch failed:', e);
    }
    return false;
}

// ── Trial phase ──────────────────────────────────────────────────────────────
export function startTrialTimer(onTick, onComplete) {
    const saved = state.trialTimerState;
    if (saved && !saved.completed) {
        trialTimer = Timer.deserialize(saved, { onTick, onComplete });
        trialTimer.resume();
    } else if (!saved) {
        trialTimer = new Timer(TRIAL_MS, { onTick, onComplete });
        trialTimer.start();
    }
    // if saved.completed => timer already expired, caller handles it
}

export function pauseTrialTimer() {
    trialTimer?.pause();
    saveState();
}

export function resumeTrialTimer() {
    trialTimer?.resume();
}

export function getTrialElapsed() {
    return trialTimer?.getElapsed() ?? (state.trialTimerState?.elapsedMs ?? 0);
}

// ── Competition phase ─────────────────────────────────────────────────────────
// Saves initial timer state only — actual timer is created by restoreCompTimer in renderTraining.
// This avoids the double-timer bug when the hash is already #training and hashchange doesn't fire.
export async function startCompetition() {
    state.phase = 'competition';
    const durationMs = state.config.targetType === 'paper' ? COMP_PAPER_MS : COMP_ELEC_MS;
    if (compTimer) { compTimer.stop(); compTimer = null; }
    state.compTimerState = { durationMs, elapsedMs: 0, completed: false, wasRunning: true };
    saveState();

    if (window.APP_USER && state.sessionId) {
        try {
            await fetch('/api/session_update.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: state.sessionId, action: 'start_competition' }),
            });
        } catch (_) {}
    }
}

export function restoreCompTimer(onTick, onComplete) {
    const saved = state.compTimerState;
    if (!saved) return false;
    if (compTimer) { compTimer.stop(); }  // stop any stale timer before replacing
    compTimer = Timer.deserialize(saved, { onTick, onComplete });
    if (!saved.completed) compTimer.resume();
    return true;
}

export function pauseCompTimer() {
    compTimer?.pause();
    saveState();
}

export function resumeCompTimer() {
    compTimer?.resume();
}

export function getCompElapsed() {
    return compTimer?.getElapsed() ?? (state.compTimerState?.elapsedMs ?? 0);
}

export function getCompRemaining() {
    if (compTimer) return compTimer.getRemaining();
    if (state.compTimerState) {
        const dur = state.config.targetType === 'paper' ? COMP_PAPER_MS : COMP_ELEC_MS;
        return Math.max(0, dur - (state.compTimerState.elapsedMs ?? 0));
    }
    return 0;
}

// ── Shot registration ────────────────────────────────────────────────────────
export function registerTrialShot(value, isMouche, x = null, y = null) {
    const shot = {
        value, isMouche, x, y,
        phase: 'trial',
        elapsedMs: getTrialElapsed(),
    };
    state.trialShots.push(shot);
    saveState();
    syncShot(shot);
    return shot;
}

export function registerCompShot(value, isMouche, x = null, y = null) {
    const total  = shotCount() + 1;
    const series = Math.ceil(total / SERIES_SIZE);
    const inSer  = ((total - 1) % SERIES_SIZE) + 1;
    const shot = {
        value, isMouche, x, y,
        phase: 'competition',
        seriesNumber:  series,
        shotInSeries:  inSer,
        shotTotal:     total,
        elapsedMs:     getCompElapsed(),
    };
    state.compShots.push(shot);
    saveState();
    syncShot(shot);

    if (remaining() === 0) {
        endCompetition('completed');
    }
    return shot;
}

async function syncShot(shot) {
    if (!window.APP_USER || !state.sessionId) return;
    try {
        await fetch('/api/shot_add.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id:     state.sessionId,
                value:          shot.value,
                is_mouche:      shot.isMouche,
                phase:          shot.phase,
                series_number:  shot.seriesNumber  ?? null,
                shot_in_series: shot.shotInSeries  ?? null,
                shot_total:     shot.shotTotal     ?? null,
                elapsed_ms:     shot.elapsedMs     ?? null,
                x:              shot.x,
                y:              shot.y,
            }),
        });
    } catch (_) {}
}

// ── End competition ──────────────────────────────────────────────────────────
export async function endCompetition(reason = 'completed') {
    compTimer?.stop();
    state.phase = reason; // 'completed' or 'aborted'
    saveState();

    if (window.APP_USER && state.sessionId) {
        try {
            await fetch('/api/session_update.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: state.sessionId, action: 'finish', status: reason }),
            });
        } catch (_) {}
    }
}

// ── Abort ────────────────────────────────────────────────────────────────────
export async function abortCompetition() {
    cancelPending();
    const elapsed = getCompElapsed();
    const remainingShots = [];

    let total = shotCount();
    while (total < TOTAL_SHOTS) {
        total++;
        const series = Math.ceil(total / SERIES_SIZE);
        const inSer  = ((total - 1) % SERIES_SIZE) + 1;
        const shot = {
            value: 0, isMouche: false, x: null, y: null,
            phase: 'competition',
            seriesNumber: series, shotInSeries: inSer, shotTotal: total,
            elapsedMs: elapsed,
        };
        state.compShots.push(shot);
        remainingShots.push(shot);
    }
    compTimer?.stop();
    state.phase = 'aborted';
    saveState();

    if (window.APP_USER && state.sessionId) {
        try {
            await fetch('/api/session_abort.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: state.sessionId, remaining_shots: remainingShots }),
            });
        } catch (_) {}
    }
}

// ── Confirm overlay logic ────────────────────────────────────────────────────
export function beginConfirm(value, isMouche, onConfirm, onCancel) {
    pendingShot = { value, isMouche, onConfirm, onCancel };
    showOverlay('overlay-confirm');

    const valEl = document.getElementById('confirm-value');
    const cdEl  = document.getElementById('confirm-countdown');
    valEl.textContent = isMouche ? 'M' : value;
    valEl.style.color = isMouche ? 'var(--mouche)' : '';

    clearConfirmTimers();

    if (state.config.confirmMode === 'auto') {
        let remaining = state.config.autoConfirmMs;
        cdEl.classList.remove('hidden');
        cdEl.textContent = `Conferma in ${(remaining / 1000).toFixed(1)}s…`;
        confirmInterval = setInterval(() => {
            remaining -= 100;
            cdEl.textContent = `Conferma in ${Math.max(0, remaining / 1000).toFixed(1)}s…`;
        }, 100);
        confirmTimeout = setTimeout(() => {
            clearConfirmTimers();
            doConfirm();
        }, remaining);
    } else {
        cdEl.classList.add('hidden');
    }
}

export function doConfirm() {
    clearConfirmTimers();
    hideOverlay('overlay-confirm');
    if (!pendingShot) return;
    const { onConfirm } = pendingShot;
    pendingShot = null;
    onConfirm?.();
}

export function cancelPending() {
    clearConfirmTimers();
    hideOverlay('overlay-confirm');
    const cb = pendingShot?.onCancel;
    pendingShot = null;
    cb?.();
}

function clearConfirmTimers() {
    if (confirmTimeout)  clearTimeout(confirmTimeout);
    if (confirmInterval) clearInterval(confirmInterval);
    confirmTimeout = null;
    confirmInterval = null;
}

// ── Overlay helpers ──────────────────────────────────────────────────────────
export function showOverlay(id) {
    document.getElementById(id)?.classList.remove('hidden');
}
export function hideOverlay(id) {
    document.getElementById(id)?.classList.add('hidden');
}

// ── Getters for UI ───────────────────────────────────────────────────────────
export function getShotCount()  { return shotCount(); }
export function getRemaining()  { return remaining(); }
export function getSeriesNum()  { return seriesNum(); }
export function getTrialShots() { return state.trialShots; }
export function getCompShots()  { return state.compShots; }
export function getConfig()     { return state.config; }
export function getSessionId()  { return state.sessionId; }
export function getPhase()      { return state.phase; }
export function TOTAL()         { return TOTAL_SHOTS; }
export function SERIES_SZ()     { return SERIES_SIZE; }
export function compDurationMs() {
    return state.config.targetType === 'paper' ? COMP_PAPER_MS : COMP_ELEC_MS;
}
