<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$outings = $pdo->query(
    'SELECT o.*, u.display_name AS creator_name FROM outings o
     JOIN users u ON u.id = o.created_by ORDER BY o.id DESC'
)->fetchAll();

foreach ($outings as &$outing) {
    $stmt = $pdo->prepare(
        'SELECT a.id, a.available_time, a.created_at, u.display_name
         FROM outing_availabilities a JOIN users u ON u.id = a.user_id
         WHERE a.outing_id = ? ORDER BY a.id ASC'
    );
    $stmt->execute([$outing['id']]);
    $outing['availabilities'] = $stmt->fetchAll();

    $stmt = $pdo->prepare(
        'SELECT c.id, c.content, c.created_at, u.display_name
         FROM outing_comments c JOIN users u ON u.id = c.user_id
         WHERE c.outing_id = ? ORDER BY c.id ASC'
    );
    $stmt->execute([$outing['id']]);
    $outing['comments'] = $stmt->fetchAll();
}
unset($outing);

jsonResponse(['outings' => $outings]);
