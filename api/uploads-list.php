<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT u.*, us.display_name FROM uploads u JOIN users us ON us.id = u.uploader_id
     ORDER BY u.id DESC LIMIT 200'
);

jsonResponse(['uploads' => $stmt->fetchAll()]);
