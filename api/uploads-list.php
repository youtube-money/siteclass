<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT u.*, us.display_name FROM uploads u JOIN users us ON us.id = u.uploader_id
     ORDER BY u.id DESC LIMIT 200'
);

$uploads = [];
foreach ($stmt->fetchAll() as $u) {
    $u['direct_link'] = 'https://drive.google.com/uc?export=view&id=' . rawurlencode($u['drive_file_id']);
    $u['view_link'] = $u['drive_view_link'] ?: ('https://drive.google.com/file/d/' . rawurlencode($u['drive_file_id']) . '/view');
    $uploads[] = $u;
}
jsonResponse(['uploads'=>$uploads]);
