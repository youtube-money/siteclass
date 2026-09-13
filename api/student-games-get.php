<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$id = (int)($_GET['id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare(
    'SELECT sg.*, u.display_name FROM student_games sg
     JOIN users u ON u.id = sg.submitted_by WHERE sg.id = ?'
);
$stmt->execute([$id]);
$game = $stmt->fetch();

if (!$game) {
    jsonResponse(['error' => 'پیدا نشد'], 404);
}

jsonResponse(['game' => $game]);
