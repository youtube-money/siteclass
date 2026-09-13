<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$outingId = (int)($input['outing_id'] ?? 0);
$availableTime = trim($input['available_time'] ?? '');

if (!$outingId || !$availableTime) {
    jsonResponse(['error' => 'اطلاعات ناقصه'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO outing_availabilities (outing_id, user_id, available_time) VALUES (?, ?, ?)');
$stmt->execute([$outingId, $me['id'], $availableTime]);

jsonResponse(['success' => true]);
