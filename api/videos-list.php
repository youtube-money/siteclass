<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT v.*, u.display_name AS added_by_name FROM videos v
     JOIN users u ON u.id = v.added_by ORDER BY v.id DESC'
);

jsonResponse(['videos' => $stmt->fetchAll()]);
