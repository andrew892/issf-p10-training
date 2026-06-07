import { fmtTime, fmtTimeMs } from './timer.js';
import { targetSvgMarkup } from './target.js';

const SERIES_SIZE = 10;

export function calcReport(compShots, trialShots, config) {
    // Competition stats
    const total  = compShots.reduce((s, sh) => s + sh.value, 0);
    const mouches = compShots.filter(sh => sh.isMouche).length;

    // Per-series
    const series = [];
    for (let i = 0; i < 6; i++) {
        const sn = i + 1;
        const sShots = compShots.filter(sh => sh.seriesNumber === sn);
        const sTotal = sShots.reduce((s, sh) => s + sh.value, 0);
        const sMouches = sShots.filter(sh => sh.isMouche).length;

        const prevLastShot = i > 0 ? compShots.filter(sh => sh.seriesNumber === i) : [];
        const startMs = prevLastShot.length > 0
            ? prevLastShot[prevLastShot.length - 1].elapsedMs
            : 0;
        const endMs = sShots.length > 0 ? sShots[sShots.length - 1].elapsedMs : startMs;
        const timeMs = endMs - startMs;
        const avgMs  = sShots.length > 0 ? timeMs / sShots.length : 0;

        // Tempo impiegato per ciascun colpo (delta rispetto al precedente, o all'inizio serie per il primo).
        // Colpi senza elapsedMs (es. dati storici o "non sparati" di una gara interrotta) contano come tempo zero.
        const shotTimes = sShots.map((sh, idx) => {
            const prevMs = idx === 0 ? startMs : sShots[idx - 1].elapsedMs;
            if (sh.elapsedMs == null || prevMs == null) return 0;
            return sh.elapsedMs - prevMs;
        });

        series.push({ number: sn, shots: sShots, total: sTotal, mouches: sMouches, timeMs, avgMs, shotTimes });
    }

    // Distribution
    const dist = {};
    for (let v = 0; v <= 10; v++) dist[v] = 0;
    compShots.forEach(sh => { dist[sh.value] = (dist[sh.value] ?? 0) + 1; });

    // Total time
    const totalTimeMs = compShots.length > 0 ? compShots[compShots.length - 1].elapsedMs : 0;
    const avgMs = compShots.length > 0 ? totalTimeMs / compShots.length : 0;

    // Trial
    const trialTotal  = trialShots.reduce((s, sh) => s + sh.value, 0);
    const trialMouches= trialShots.filter(sh => sh.isMouche).length;
    const trialDist   = {};
    for (let v = 0; v <= 10; v++) trialDist[v] = 0;
    trialShots.forEach(sh => { trialDist[sh.value] = (trialDist[sh.value] ?? 0) + 1; });

    // Tempo per colpo sull'intera gara (concatenazione dei delta di ogni serie, stesso calcolo)
    const allShotTimes = series.flatMap(s => s.shotTimes);

    const hasGroupData = config.scoreMode === 'group'
        && compShots.some(sh => sh.x !== null && sh.x !== undefined);
    const hasTrialGroupData = config.scoreMode === 'group'
        && trialShots.some(sh => sh.x !== null && sh.x !== undefined);

    return { total, mouches, series, dist, totalTimeMs, avgMs, config, hasGroupData, allShotTimes,
             trial: { count: trialShots.length, total: trialTotal, mouches: trialMouches,
                      dist: trialDist, shots: trialShots, hasGroupData: hasTrialGroupData } };
}

// Mini-grafico a linee (sparkline) del tempo impiegato per ciascun colpo:
// scala min/max per evidenziare la tendenza anche su variazioni piccole.
function shotTimeChartSvg(values, { width = 280, height = 50, padding = 6 } = {}) {
    if (!values.length) return '<p class="time-label">–</p>';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = (max - min) || 1;
    const innerH = height - padding * 2;
    const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => [
        padding + i * stepX,
        padding + innerH - ((v - min) / range) * innerH
    ]);
    const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const dots = pts.map(([x, y]) => `<circle class="time-chart-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" />`).join('');
    return `<svg class="time-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline class="time-chart-line" points="${points}" />
        ${dots}
    </svg>`;
}

export function renderReport(report, { isAborted = false, sessionDate = null } = {}) {
    const { total, mouches, series, dist, totalTimeMs, avgMs, config, trial, hasGroupData, allShotTimes } = report;
    const targetLabel = config.targetType === 'paper' ? 'Cartaceo' : 'Elettronico';
    const dateStr = sessionDate
        ? new Date(sessionDate).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
        : new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

    const seriesRows = series.map(s => `
        <tr>
            <td>Serie ${s.number}</td>
            <td class="series-score">${s.total}</td>
            <td class="series-mouches">(${s.mouches})</td>
            <td class="series-time">${fmtTime(s.timeMs)}</td>
            <td class="series-avg">${fmtAvg(s.avgMs)}/colpo</td>
        </tr>
    `).join('');

    const distItems = [10,9,8,7,6,5,4,3,2,1,0].map(v => `
        <div class="dist-item">
            <span class="dist-val">${v}</span>
            <span class="dist-count">${dist[v] ?? 0}</span>
        </div>
    `).join('');

    const trialDistItems = [10,9,8,7,6,5,4,3,2,1,0]
        .filter(v => (trial.dist[v] ?? 0) > 0)
        .map(v => `
            <div class="dist-item">
                <span class="dist-val">${v}</span>
                <span class="dist-count">${trial.dist[v]}</span>
            </div>
        `).join('');

    const timesRows = series.map(s => `
        <div class="time-row">
            <span class="time-label">Serie ${s.number}</span>
            <span class="time-value">${fmtTime(s.timeMs)} (${fmtAvg(s.avgMs)}/colpo)</span>
        </div>
        <div class="time-chart-wrap">
            <div class="time-chart-label">Tempo per colpo — serie ${s.number}</div>
            ${shotTimeChartSvg(s.shotTimes)}
        </div>
    `).join('');

    const rosateSection = hasGroupData ? `
        <div class="report-section">
            <div class="report-section-title">Rosate</div>
            <div class="rosate-grid">
                ${series.map(s => `
                    <div class="rosata-item">
                        <div class="rosata-label">Serie ${s.number}</div>
                        ${targetSvgMarkup(s.shots, { sizePx: 110 })}
                    </div>
                `).join('')}
                <div class="rosata-item rosata-total">
                    <div class="rosata-label">Totale gara</div>
                    ${targetSvgMarkup(series.flatMap(s => s.shots), { sizePx: 240 })}
                </div>
            </div>
        </div>` : '';

    const abortedBadge = isAborted
        ? '<div class="status-aborted">★ Interrotta — colpi rimanenti registrati come 0</div>' : '';

    return `
    <div class="report-card" id="report-card">
        <div class="report-header">
            <h2>P10 — Report Gara</h2>
            <p>${dateStr} | ${targetLabel}</p>
            ${abortedBadge}
        </div>

        <div class="report-total">
            <div class="score">${total} <span style="font-size:1.4rem">(${mouches})</span></div>
        </div>

        <div class="report-section">
            <div class="report-section-title">Per serie</div>
            <table class="series-table">
                <tbody>${seriesRows}</tbody>
            </table>
        </div>
        ${rosateSection}

        <div class="report-section">
            <div class="report-section-title">Distribuzione colpi gara</div>
            <div class="dist-grid">${distItems}</div>
        </div>

        <div class="report-section">
            <div class="report-section-title">Tempi</div>
            <div class="times-grid">
                <div class="time-row">
                    <span class="time-label">Totale gara</span>
                    <span class="time-value">${fmtTime(totalTimeMs)}</span>
                </div>
                <div class="time-row">
                    <span class="time-label">Media/colpo</span>
                    <span class="time-value">${fmtAvg(avgMs)}</span>
                </div>
                <hr class="divider">
                ${timesRows}
                <hr class="divider">
                <div class="time-chart-wrap time-chart-overall">
                    <div class="time-chart-label">Tempo per colpo — gara completa</div>
                    ${shotTimeChartSvg(allShotTimes, { width: 560, height: 70 })}
                </div>
            </div>
        </div>

        ${trial.count > 0 ? `
        <div class="report-section">
            <div class="report-section-title">Colpi di prova</div>
            <div class="time-row mb-16" style="margin-bottom:10px">
                <span class="time-label">Colpi sparati</span>
                <span class="time-value">${trial.count}</span>
            </div>
            <div class="time-row mb-16" style="margin-bottom:10px">
                <span class="time-label">Totale</span>
                <span class="time-value">${trial.total} (${trial.mouches})</span>
            </div>
            ${trialDistItems ? `<div class="dist-grid" style="margin-top:8px">${trialDistItems}</div>` : ''}
            ${trial.hasGroupData ? `
            <div style="display:flex; justify-content:center; margin-top:12px">
                <div class="rosata-item">
                    <div class="rosata-label">Rosata prova</div>
                    ${targetSvgMarkup(trial.shots, { sizePx: 130 })}
                </div>
            </div>` : ''}
        </div>` : ''}
    </div>
    <div class="rosata-zoom hidden" id="rosata-zoom">
        <div class="rosata-zoom-box" id="rosata-zoom-box"></div>
        <div class="rosata-zoom-label" id="rosata-zoom-label"></div>
    </div>`;
}

// Collega il tap su ogni mini-bersaglio "rosata" all'overlay a schermo intero:
// clona l'<svg> già renderizzato (stessi anelli/colpi) e lo mostra ingrandito.
export function initRosataZoom() {
    const overlay = document.getElementById('rosata-zoom');
    const box = document.getElementById('rosata-zoom-box');
    const label = document.getElementById('rosata-zoom-label');
    if (!overlay || !box || !label) return;

    const close = () => overlay.classList.add('hidden');
    overlay.addEventListener('click', close);

    document.querySelectorAll('.rosata-item').forEach(item => {
        const svg = item.querySelector('svg');
        if (!svg) return;
        item.addEventListener('click', () => {
            box.innerHTML = '';
            box.appendChild(svg.cloneNode(true));
            label.textContent = item.querySelector('.rosata-label')?.textContent || '';
            overlay.classList.remove('hidden');
        });
    });
}

function fmtAvg(ms) {
    if (!ms || ms <= 0) return '–';
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(0).padStart(2,'0');
    return `${m}:${s}`;
}

export async function exportPNG(elementId = 'report-card') {
    const el = document.getElementById(elementId);
    if (!el) return;
    // Dynamically load html2canvas from CDN
    const { default: html2canvas } = await import(
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.min.js'
    );
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
    const link = document.createElement('a');
    link.download = `p10-report-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

