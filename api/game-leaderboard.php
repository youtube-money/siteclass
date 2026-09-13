<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$gameKey = trim($_GET['game_key'] ?? '');

$pdo = getDB();
if ($gameKey) {
    $stmt = $pdo->prepare(
        'SELECT g.game_key, g.score, g.created_at, u.display_name
         FROM game_scores g JOIN users u ON u.id = g.user_id
         WHERE g.game_key = ? ORDER BY g.score DESC LIMIT 10'
    );
    $stmt->execute([$gameKey]);
} else {
    $stmt = $pdo->query(
        'SELECT g.game_key, g.score, g.created_at, u.display_name
         FROM game_scores g JOIN users u ON u.id = g.user_id
         ORDER BY g.score DESC LIMIT 10'
    );
}

jsonResponse(['leaderboard' => $stmt->fetchAll()]);
