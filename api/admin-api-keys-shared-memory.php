<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();
$enabled = !empty($input['enabled']);

$pdo = getDB();
$stmt = $pdo->prepare(
    "INSERT INTO site_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('shared_memory_lessons', ?, ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()"
);
$stmt->execute([$enabled ? '1' : '0', $me['id']]);

jsonResponse(['success' => true]);
