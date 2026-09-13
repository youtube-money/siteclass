<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$gameKey = trim($input['game_key'] ?? '');
$score = (int)($input['score'] ?? -1);

if (!$gameKey || $score < 0) {
    jsonResponse(['error' => 'اطلاعات نامعتبره'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO game_scores (user_id, game_key, score) VALUES (?, ?, ?)');
$stmt->execute([$me['id'], $gameKey, $score]);

jsonResponse(['success' => true]);
