<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireLogin();
$input = getJsonInput();

$displayName = trim($input['display_name'] ?? '');
$avatarEmoji = trim($input['avatar_emoji'] ?? '');
$bio = trim($input['bio'] ?? '');
$themeColor = trim($input['theme_color'] ?? '');

if (!$displayName) {
    jsonResponse(['error' => 'نام نمایشی نمی‌تونه خالی باشه'], 400);
}

// رنگ تم فقط برای نقش ویژه یا ادمین قابل‌تنظیمه
$canSetTheme = in_array($me['role'], ['special', 'admin'], true);

$pdo = getDB();
if ($canSetTheme) {
    $stmt = $pdo->prepare(
        'UPDATE users SET display_name = ?, avatar_emoji = ?, bio = ?, theme_color = ? WHERE id = ?'
    );
    $stmt->execute([$displayName, $avatarEmoji ?: '🙂', $bio ?: null, $themeColor ?: null, $me['id']]);
} else {
    $stmt = $pdo->prepare('UPDATE users SET display_name = ?, avatar_emoji = ?, bio = ? WHERE id = ?');
    $stmt->execute([$displayName, $avatarEmoji ?: '🙂', $bio ?: null, $me['id']]);
}

jsonResponse(['success' => true]);
