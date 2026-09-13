<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/gemini.php';

$me = requireLogin();
$input = getJsonInput();

$chatType = $input['chat_type'] ?? '';
$recipientId = isset($input['recipient_id']) ? (int)$input['recipient_id'] : null;
$content = trim($input['content'] ?? '');
$mediaUrl = $input['media_url'] ?? null;
$mediaType = $input['media_type'] ?? null;

if (!in_array($chatType, ['group', 'private'], true)) {
    jsonResponse(['error' => 'نوع چت نامعتبره'], 400);
}
if (!$content && !$mediaUrl) {
    jsonResponse(['error' => 'پیام خالیه'], 400);
}
if ($chatType === 'private' && !$recipientId) {
    jsonResponse(['error' => 'برای چت خصوصی، گیرنده مشخص نشده'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO messages (sender_id, recipient_id, chat_type, content, media_url, media_type)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $me['id'],
    $chatType === 'private' ? $recipientId : null,
    $chatType,
    $content ?: null,
    $mediaUrl,
    $mediaType,
]);

$messageId = $pdo->lastInsertId();

// ===== چت‌بات کلاس: اگه پیام گروهی با /بات شروع بشه، دستیار جواب می‌ده =====
if ($chatType === 'group' && $content && (str_starts_with($content, '/بات') || str_starts_with($content, '/bot'))) {
    triggerClassBot($pdo, $content);
}

jsonResponse(['success' => true, 'messageId' => $messageId]);

function triggerClassBot(PDO $pdo, string $triggerMessage): void {
    $botKey = $pdo->query("SELECT api_key FROM site_api_keys WHERE key_role = 'chatbot' LIMIT 1")->fetch();
    if (!$botKey) return; // ادمین هنوز کلید چت‌بات رو تنظیم نکرده

    $botUser = $pdo->query("SELECT id FROM users WHERE username = 'classroom_bot'")->fetch();
    if (!$botUser) return;

    $question = trim(preg_replace('/^\/(بات|bot)/u', '', $triggerMessage));
    if (!$question) return;

    try {
        $reply = callGemini(
            $botKey['api_key'],
            [],
            $question,
            'تو دستیار یه گروه کلاسی هستی. کوتاه، دوستانه و مفید به فارسی جواب بده.'
        );
    } catch (Exception $e) {
        $reply = 'الان نمی‌تونم جواب بدم، بعداً امتحان کن.';
    }

    $stmt = $pdo->prepare(
        "INSERT INTO messages (sender_id, recipient_id, chat_type, content) VALUES (?, NULL, 'group', ?)"
    );
    $stmt->execute([$botUser['id'], $reply]);
}
