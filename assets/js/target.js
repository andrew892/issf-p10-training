// Geometria del bersaglio P10 (10m aria compressa) e disegno SVG condiviso
// tra il widget di input "a rosata", la lente d'ingrandimento e le rosate nel report.
// Tutte le coordinate sono in millimetri, origine al centro del bersaglio.

export const BULLET_DIAMETER_MM = 4.5;
export const BULLET_RADIUS_MM = BULLET_DIAMETER_MM / 2; // 2.25

export const TARGET_OUTER_RADIUS_MM = 77.75; // bordo esterno anello 1
export const AIMING_DISK_RADIUS_MM = 29.75;  // bordo nero (= anello 7)

// Ordinati dal raggio più piccolo (punteggio più alto) al più grande:
// il primo anello "toccato" dal bordo del foro determina punteggio e mouche.
export const RINGS = [
    { value: 10, radiusMm: 2.5,   isMouche: true  },
    { value: 10, radiusMm: 5.75,  isMouche: false },
    { value: 9,  radiusMm: 13.75, isMouche: false },
    { value: 8,  radiusMm: 21.75, isMouche: false },
    { value: 7,  radiusMm: 29.75, isMouche: false },
    { value: 6,  radiusMm: 37.75, isMouche: false },
    { value: 5,  radiusMm: 45.75, isMouche: false },
    { value: 4,  radiusMm: 53.75, isMouche: false },
    { value: 3,  radiusMm: 61.75, isMouche: false },
    { value: 2,  radiusMm: 69.75, isMouche: false },
    { value: 1,  radiusMm: 77.75, isMouche: false },
];

// Colori fissi del volto del bersaglio: un bersaglio reale è sempre bianco/nero,
// indipendente dal tema chiaro/scuro dell'app.
const FACE_WHITE = '#f5f5f0';
const FACE_BLACK = '#1a1a1a';
const STROKE_ON_WHITE = '#333';
const STROKE_ON_BLACK = '#ddd';

// Calcola punteggio e mouche dalla posizione (mm) del centro del colpo.
// Regola: il colpo vale il punteggio dell'anello più interno il cui bordo
// esterno è toccato (anche solo tangente) dal foro del proiettile.
export function scoreAt(xMm, yMm) {
    const dist = Math.hypot(xMm, yMm);
    const edge = dist - BULLET_RADIUS_MM;
    for (const ring of RINGS) {
        if (edge <= ring.radiusMm) {
            return { value: ring.value, isMouche: ring.isMouche, dist, edge };
        }
    }
    return { value: 0, isMouche: false, dist, edge };
}

// Markup SVG (solo elementi interni, nessun wrapper <svg>) per il volto del
// bersaglio: sfondo bianco, disco di mira nero, linee degli anelli con tratto
// chiaro sul nero e scuro sul bianco.
export function targetRingsSvg({ strokeWidth = 0.5 } = {}) {
    let s = '';
    s += `<circle cx="0" cy="0" r="${TARGET_OUTER_RADIUS_MM}" fill="${FACE_WHITE}" />`;
    s += `<circle cx="0" cy="0" r="${AIMING_DISK_RADIUS_MM}" fill="${FACE_BLACK}" />`;
    for (const ring of RINGS) {
        const onBlack = ring.radiusMm <= AIMING_DISK_RADIUS_MM;
        const stroke = onBlack ? STROKE_ON_BLACK : STROKE_ON_WHITE;
        s += `<circle cx="0" cy="0" r="${ring.radiusMm}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    return s;
}

// Markup di un singolo pallino (foro del proiettile) centrato in (xMm, yMm).
// I colori di default sono fissi (non legati al tema): un foro su un bersaglio
// cartaceo è sempre scuro con un bordo chiaro per essere visibile sul nero/bianco.
export function shotMarkerSvg(xMm, yMm, { fill = '#c0392b', radiusMm = BULLET_RADIUS_MM } = {}) {
    return `<circle cx="${xMm}" cy="${yMm}" r="${radiusMm}" fill="${fill}" />`;
}

// Costruisce un <svg> completo (bersaglio + N pallini), pronto per essere
// inserito via innerHTML — usato dal report per le rosate per serie/totale.
export function targetSvgMarkup(shots, { sizePx = 120, markerFill = '#c0392b' } = {}) {
    const R = TARGET_OUTER_RADIUS_MM;
    const dots = (shots || [])
        .filter(sh => sh && sh.x != null && sh.y != null)
        .map(sh => shotMarkerSvg(sh.x, sh.y, { fill: markerFill }))
        .join('');
    return `<svg viewBox="${-R} ${-R} ${2 * R} ${2 * R}" width="${sizePx}" height="${sizePx}" preserveAspectRatio="xMidYMid meet">`
        + targetRingsSvg()
        + dots
        + `</svg>`;
}
