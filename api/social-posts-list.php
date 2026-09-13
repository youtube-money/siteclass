<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

// ⚠️ این محدودیت نقش عمدیه — این بخش نباید برای نقش 'student' قابل‌دسترسی باشه
requireRole(['special', 'admin']);

$pdo = getDB();
$stmt = $pdo->query(
    'SELECT p.*, u.display_name, u.avatar_emoji FROM social_posts p
     JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100'
);

jsonResponse(['posts' => $stmt->fetchAll()]);
