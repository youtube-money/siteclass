<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/gemini.php';

requireLogin();
$input = getJsonInput();

$code = trim($input['code'] ?? '');
$question = trim($input['question'] ?? '');

if (!$code && !$question) {
    jsonResponse(['error' => 'کد یا سوالت رو بنویس'], 400);
}

$pdo = getDB();
$row = $pdo->query("SELECT api_key FROM site_api_keys WHERE key_role = 'coding' LIMIT 1")->fetch();

if (!$row) {
    jsonResponse(['error' => 'ادمین هنوز کلید پیش‌فرض بخش کدنویسی رو تنظیم نکرده'], 400);
}

$prompt = "کد زیر رو بررسی کن و کمکم کن:\n\n```\n$code\n```\n\nسوال/درخواست من: " . ($question ?: 'کد رو بررسی کن و راهنمایی بده');

try {
    $reply = callGemini(
        $row['api_key'],
        [],
        $prompt,
        'تو دستیار برنامه‌نویسی برای دانش‌آموزهای یه کلاسی. راهنمایی رو ساده، گام‌به‌گام و به فارسی بده. مستقیم راه‌حل کامل رو نده مگه لازم باشه؛ سعی کن یاد بدی.'
    );
    jsonResponse(['reply' => $reply]);
} catch (Exception $e) {
    jsonResponse(['error' => 'دستیار کدنویسی جواب نداد، دوباره امتحان کن'], 502);
}
