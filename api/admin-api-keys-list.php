<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireRole(['admin']);

$pdo = getDB();
$stmt = $pdo->query('SELECT id, label, key_role, api_key FROM site_api_keys ORDER BY id ASC');
$keys = $stmt->fetchAll();

foreach ($keys as &$k) {
    $k['last_four'] = substr($k['api_key'], -4);
    unset($k['api_key']);
}
unset($k);

$sharedMemory = $pdo->query("SELECT setting_value FROM site_settings WHERE setting_key = 'shared_memory_lessons'")->fetch();

jsonResponse([
    'keys' => $keys,
    'sharedMemory' => $sharedMemory ? $sharedMemory['setting_value'] === '1' : true,
]);
