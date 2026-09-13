<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();
$count = (int)($input['lessons_per_day'] ?? 0);

if ($count < 1 || $count > 12) {
    jsonResponse(['error' => 'عدد نامعتبره (بین ۱ تا ۱۲)'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    "INSERT INTO site_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('lessons_per_day', ?, ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()"
);
$stmt->execute([(string)$count, $me['id']]);

jsonResponse(['success' => true]);
