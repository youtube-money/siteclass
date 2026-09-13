<?php
// تماس با Gemini API (generateContent) — فقط با curl، بدون نیاز به SDK

/**
 * @param string $apiKey کلید API (مال ادمین یا خودِ دانش‌آموز)
 * @param array $history آرایه‌ای از [ ['role' => 'user'|'model', 'text' => '...'], ... ]
 * @param string $newMessage پیام جدید کاربر
 * @param string|null $systemInstruction دستور سیستمی اختیاری (شخصیت/محدودیت‌های دستیار)
 */
function callGemini(string $apiKey, array $history, string $newMessage, ?string $systemInstruction = null): string {
    $contents = [];
    foreach ($history as $turn) {
        $contents[] = ['role' => $turn['role'], 'parts' => [['text' => $turn['message']]]];
    }
    $contents[] = ['role' => 'user', 'parts' => [['text' => $newMessage]]];

    $body = ['contents' => $contents];
    if ($systemInstruction) {
        $body['systemInstruction'] = ['parts' => [['text' => $systemInstruction]]];
    }

    $model = 'gemini-3.5-flash'; // اگه بعداً مدل جدیدتری اومد، فقط همین خط رو عوض کن
    $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "x-goog-api-key: $apiKey",
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

    if (!$text) {
        throw new Exception('پاسخی از AI دریافت نشد: ' . $response);
    }

    return $text;
}
