<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/Auth.php';

ini_set('session.cookie_samesite', 'Lax');
session_name(SESSION_NAME);
session_start();

$auth = new Auth();
$user = $auth->currentUser();
$userData = $user ? [
    'id'       => (int)$user['id'],
    'username' => $user['username'],
    'is_admin' => (bool)$user['is_admin'],
] : null;
?>
<!DOCTYPE html>
<html lang="it" data-theme="auto">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f5f5f0" media="(prefers-color-scheme: light)">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="P10">
    <title>P10 — Simulatore Gara</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192.png">
    <link rel="stylesheet" href="/assets/css/style.css?v=<?= APP_VERSION ?>">
    <script>/* apply theme before first paint to avoid flash */
    (function(){var t=localStorage.getItem('p10_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}());
    </script>
</head>
<body>
    <button id="theme-toggle" class="theme-btn theme-btn-floating" aria-label="Cambia tema" title="Cambia tema"></button>
    <div id="app">
        <div class="splash">
            <div class="splash-inner">
                <div class="target-icon">⊙</div>
                <p>Caricamento…</p>
            </div>
        </div>
    </div>

    <div id="overlay-confirm" class="overlay hidden" role="dialog" aria-modal="true">
        <div class="overlay-card">
            <div class="overlay-shot-value" id="confirm-value"></div>
            <div class="overlay-countdown hidden" id="confirm-countdown"></div>
            <div class="overlay-actions">
                <button class="btn btn-primary btn-lg" id="btn-confirm">Conferma</button>
                <button class="btn btn-ghost" id="btn-cancel">Annulla</button>
            </div>
        </div>
    </div>

    <div id="overlay-pause" class="overlay hidden" role="dialog" aria-modal="true">
        <div class="overlay-card overlay-pause-card">
            <div class="pause-label">PAUSA</div>
            <button class="btn btn-primary btn-lg" id="btn-resume">Riprendi</button>
        </div>
    </div>

    <div id="overlay-abort" class="overlay hidden" role="dialog" aria-modal="true">
        <div class="overlay-card">
            <h3>Interrompere la gara?</h3>
            <p id="abort-msg"></p>
            <div class="overlay-actions">
                <button class="btn btn-danger btn-lg" id="btn-abort-confirm">Sì, interrompi</button>
                <button class="btn btn-ghost" id="btn-abort-cancel">Annulla</button>
            </div>
        </div>
    </div>

    <script>
        window.APP_USER = <?= json_encode($userData) ?>;
        window.APP_VERSION = '<?= APP_VERSION ?>';
    </script>
    <script type="module" src="/assets/js/app.js?v=<?= APP_VERSION ?>"></script>
</body>
</html>
