<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->prepare(
    "SELECT m.*, u.display_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_type = 'group' ORDER BY m.id DESC LIMIT 50"
);
$stmt->execute();
$messages = array_reverse($stmt->fetchAll());

jsonResponse(['messages' => $messages]);
