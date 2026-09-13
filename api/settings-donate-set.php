<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['admin']);
$input = getJsonInput();

$accountNumber = trim($input['account_number'] ?? '');
$accountName = trim($input['account_name'] ?? '');

if (!$accountNumber || !$accountName) {
    jsonResponse(['error' => 'شماره حساب و اسم صاحب حساب الزامیه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    "INSERT INTO site_settings (setting_key, setting_value, updated_by, updated_at) VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()"
);
$stmt->execute(['donate_account_number', $accountNumber, $me['id']]);
$stmt->execute(['donate_account_name', $accountName, $me['id']]);

jsonResponse(['success' => true]);
