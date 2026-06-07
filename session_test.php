<?php
// RIMUOVERE dopo il debug
session_name('p10_session');
session_start();

if (isset($_GET['set'])) {
    $_SESSION['test'] = 'funziona_' . time();
    echo "Sessione impostata: " . $_SESSION['test'];
    echo "<br><a href='session_test.php'>Ricarica per verificare</a>";
} elseif (isset($_SESSION['test'])) {
    echo "✅ Sessione letta correttamente: " . $_SESSION['test'];
    echo "<br>Session ID: " . session_id();
    echo "<br><a href='session_test.php?set=1'>Reimposta</a>";
} else {
    echo "❌ Sessione vuota o persa";
    echo "<br>Session ID: " . session_id();
    echo "<br>Cookie ricevuto: " . ($_COOKIE['p10_session'] ?? '(nessuno)');
    echo "<br><a href='session_test.php?set=1'>Imposta sessione</a>";
}

// Mostra headers che verranno inviati
$headers = [];
foreach (headers_list() as $h) {
    if (stripos($h, 'set-cookie') !== false) $headers[] = $h;
}
if ($headers) {
    echo "<br><br>Set-Cookie headers: " . implode(', ', $headers);
}
