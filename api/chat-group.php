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
foreach ($messages as &$message) {
    if (!empty($message['media_url']) && preg_match('~drive\\.google\\.com/(?:uc\\?[^#]*id=|file/d/)([A-Za-z0-9_-]+)~', (string)$message['media_url'], $m)) {
        $message['media_url'] = '/api/google-file.php?id=' . rawurlencode($m[1]);
    }
}
unset($message);

jsonResponse(['messages' => $messages]);
