<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$subjectId = (int)($_GET['subject_id'] ?? 0);

$pdo = getDB();
$stmt = $pdo->prepare(
    'SELECT c.*, u.display_name FROM lesson_contents c JOIN users u ON u.id = c.user_id
     WHERE c.subject_id = ? ORDER BY c.id DESC'
);
$stmt->execute([$subjectId]);

jsonResponse(['contents' => $stmt->fetchAll()]);
