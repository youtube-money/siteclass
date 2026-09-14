<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$gameKey = trim($_GET['game_key'] ?? '');

$pdo = getDB();
if ($gameKey) {
    $stmt = $pdo->prepare(
        'SELECT u.display_name, MAX(g.score) AS score
         FROM game_scores g
         JOIN users u ON u.id = g.user_id
         WHERE g.game_key = ?
         GROUP BY g.user_id, u.display_name
         ORDER BY score DESC, u.display_name ASC
         LIMIT 10'
    );
    $stmt->execute([$gameKey]);
} else {
    $stmt = $pdo->query(
        'SELECT g.game_key, u.display_name, MAX(g.score) AS score
         FROM game_scores g
         JOIN users u ON u.id = g.user_id
         GROUP BY g.game_key, g.user_id, u.display_name
         ORDER BY g.game_key ASC, score DESC, u.display_name ASC'
    );
}

jsonResponse(['leaderboard' => $stmt->fetchAll()]);
