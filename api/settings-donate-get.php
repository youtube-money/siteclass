<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$rows = $pdo->query(
    "SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('donate_account_number', 'donate_account_name')"
)->fetchAll();

$data = ['account_number' => null, 'account_name' => null];
foreach ($rows as $r) {
    if ($r['setting_key'] === 'donate_account_number') $data['account_number'] = $r['setting_value'];
    if ($r['setting_key'] === 'donate_account_name') $data['account_name'] = $r['setting_value'];
}

jsonResponse($data);
