<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$bugs = $pdo->query(
    'SELECT b.*, u.display_name AS reporter_name FROM bug_reports b
     JOIN users u ON u.id = b.reported_by ORDER BY b.id DESC'
)->fetchAll();

foreach ($bugs as &$bug) {
    $stmt = $pdo->prepare(
        'SELECT c.*, u.display_name FROM bug_comments c JOIN users u ON u.id = c.user_id
         WHERE c.bug_id = ? ORDER BY c.id ASC'
    );
    $stmt->execute([$bug['id']]);
    $bug['comments'] = $stmt->fetchAll();
}
unset($bug);

jsonResponse(['bugs' => $bugs]);
