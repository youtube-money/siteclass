<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$chapterId = (int)($_GET['chapter_id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare(
    'SELECT n.*, u.display_name FROM notes n JOIN users u ON u.id = n.uploader_id
     WHERE n.chapter_id = ? ORDER BY n.id DESC'
);
$stmt->execute([$chapterId]);

jsonResponse(['notes' => $stmt->fetchAll()]);
