export class Timer {
    #durationMs;
    #elapsedMs = 0;      // total elapsed excluding current run
    #runStarted = null;  // Date.now() when current run started
    #interval = null;
    #onTick;
    #onComplete;
    #completed = false;

    constructor(durationMs, { onTick, onComplete } = {}) {
        this.#durationMs = durationMs;
        this.#onTick = onTick;
        this.#onComplete = onComplete;
    }

    get isRunning() { return this.#interval !== null; }
    get isPaused()  { return this.#runStarted === null && !this.#completed; }
    get isComplete(){ return this.#completed; }

    getElapsed() {
        if (this.#runStarted !== null) {
            return this.#elapsedMs + (Date.now() - this.#runStarted);
        }
        return this.#elapsedMs;
    }

    getRemaining() {
        return Math.max(0, this.#durationMs - this.getElapsed());
    }

    start() {
        if (this.isRunning || this.#completed) return;
        this.#runStarted = Date.now();
        this.#tick();
        this.#interval = setInterval(() => this.#tick(), 100);
    }

    pause() {
        if (!this.isRunning) return;
        this.#elapsedMs += Date.now() - this.#runStarted;
        this.#runStarted = null;
        clearInterval(this.#interval);
        this.#interval = null;
        this.#onTick?.(this.getElapsed(), this.getRemaining());
    }

    resume() {
        if (this.isRunning || this.#completed) return;
        this.start();
    }

    stop() {
        if (this.#interval) {
            clearInterval(this.#interval);
            this.#interval = null;
        }
        if (this.#runStarted !== null) {
            this.#elapsedMs += Date.now() - this.#runStarted;
            this.#runStarted = null;
        }
        this.#completed = true;
    }

    serialize() {
        return {
            durationMs: this.#durationMs,
            elapsedMs:  this.getElapsed(),
            completed:  this.#completed,
            wasRunning: this.isRunning,
        };
    }

    static deserialize(state, callbacks = {}) {
        const t = new Timer(state.durationMs, callbacks);
        t.#elapsedMs = state.elapsedMs ?? 0;
        t.#completed = state.completed ?? false;
        // Always restore as paused; caller decides when to resume
        return t;
    }

    #tick() {
        const elapsed   = this.getElapsed();
        const remaining = this.getRemaining();
        this.#onTick?.(elapsed, remaining);
        if (remaining <= 0 && !this.#completed) {
            this.#completed = true;
            clearInterval(this.#interval);
            this.#interval = null;
            this.#runStarted = null;
            this.#onComplete?.();
        }
    }
}

export function fmtTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export function fmtTimeMs(ms) {
    const totalSec = ms / 1000;
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toFixed(1);
    if (m > 0) return `${m}:${String(Math.floor(totalSec % 60)).padStart(2,'0')}`;
    return `${s}s`;
}
