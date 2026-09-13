<?php
// اتصال به گوگل‌درایو با سرویس‌اکانت — فقط با openssl و curl داخلی PHP، بدون نیاز به composer/کتابخونهٔ خارجی
// ⚠️ فایل امنیتی — دست‌کاری این فایل کلید گوگل‌درایوت رو در خطر می‌ندازه.

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function getGoogleAccessToken(string $clientEmail, string $privateKeyPem): string {
    $now = time();
    $header = base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claim = base64UrlEncode(json_encode([
        'iss' => $clientEmail,
        'scope' => 'https://www.googleapis.com/auth/drive.file',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ]));
    $signingInput = "$header.$claim";

    $signature = '';
    $ok = openssl_sign($signingInput, $signature, $privateKeyPem, 'sha256WithRSAEncryption');
    if (!$ok) {
        throw new Exception('کلید خصوصی گوگل نامعتبره — GOOGLE_PRIVATE_KEY رو توی config.php چک کن');
    }
    $jwt = $signingInput . '.' . base64UrlEncode($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    if (!isset($data['access_token'])) {
        throw new Exception('اتصال به گوگل ناموفق بود: ' . $response);
    }
    return $data['access_token'];
}

function uploadFileToDrive(string $accessToken, string $folderId, string $tmpPath, string $fileName, string $mimeType): array {
    $metadata = json_encode(['name' => $fileName, 'parents' => [$folderId]]);
    $boundary = 'classsite_' . uniqid();
    $fileContent = file_get_contents($tmpPath);

    $body = "--$boundary\r\n";
    $body .= "Content-Type: application/json; charset=UTF-8\r\n\r\n$metadata\r\n";
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: $mimeType\r\n\r\n";
    $body .= $fileContent . "\r\n";
    $body .= "--$boundary--";

    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $accessToken",
        "Content-Type: multipart/related; boundary=$boundary",
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    if (!isset($data['id'])) {
        throw new Exception('آپلود به درایو ناموفق بود: ' . $response);
    }
    return $data;
}

function makeDriveFilePublic(string $accessToken, string $fileId): void {
    $ch = curl_init("https://www.googleapis.com/drive/v3/files/$fileId/permissions");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $accessToken",
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['role' => 'reader', 'type' => 'anyone']));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
}
