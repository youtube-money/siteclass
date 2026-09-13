<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT p.*, u.display_name AS creator_name FROM projects p
     JOIN users u ON u.id = p.created_by ORDER BY p.subject, p.id DESC'
);

jsonResponse(['projects' => $stmt->fetchAll()]);
