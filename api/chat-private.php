<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$otherId = (int)($_GET['with'] ?? 0);

if (!$otherId) {
    jsonResponse(['error' => 'مخاطب مشخص نشده'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    "SELECT m.*, u.display_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.chat_type = 'private'
       AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
     ORDER BY m.id DESC LIMIT 50"
);
$stmt->execute([$me['id'], $otherId, $otherId, $me['id']]);
$messages = array_reverse($stmt->fetchAll());

jsonResponse(['messages' => $messages]);
