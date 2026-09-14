<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';

$me = requireRole(['special', 'admin']);
$input = getJsonInput();
$content = trim($input['content'] ?? '');
$mediaUrl = trim($input['media_url'] ?? '');
$mediaType = trim($input['media_type'] ?? '');

if (!$content && !$mediaUrl) {
    jsonResponse(['error' => 'پست نمی‌تونه کاملاً خالی باشه.'], 400);
}

if ($mediaUrl && !in_array($mediaType, ['image', 'video'], true)) {
    jsonResponse(['error' => 'نوع فایل شبکه اجتماعی نامعتبره.'], 400);
}

// برای اینکه نیاز به تغییر دیتابیس فعلی نباشد، مدیای پست داخل content با یک marker داخلی ذخیره می‌شود.
$storedContent = $content;
if ($mediaUrl) {
    $meta = base64_encode(json_encode([
        'url' => $mediaUrl,
        'type' => $mediaType,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $storedContent = "__SCMEDIA__{$meta}__ENDSCMEDIA__\n" . $content;
}

$pdo = getDB();
$stmt = $pdo->prepare('INSERT INTO social_posts (user_id, content) VALUES (?, ?)');
$stmt->execute([$me['id'], $storedContent]);

jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
