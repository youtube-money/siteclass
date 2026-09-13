<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT sg.id, sg.title, sg.description, sg.created_at, u.display_name
     FROM student_games sg JOIN users u ON u.id = sg.submitted_by
     ORDER BY sg.id DESC'
);

jsonResponse(['games' => $stmt->fetchAll()]);
