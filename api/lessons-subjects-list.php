<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT s.*, u.display_name AS creator_name,
     (SELECT COUNT(*) FROM lesson_contents c WHERE c.subject_id = s.id) AS content_count
     FROM lesson_subjects s JOIN users u ON u.id = s.created_by
     ORDER BY s.id ASC'
);

jsonResponse(['subjects' => $stmt->fetchAll()]);
