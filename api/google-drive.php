<?php
// اتصال به گوگل‌درایو با سرویس‌اکانت — فقط با openssl و curl داخلی PHP، بدون composer
// آپلود فایل به‌صورت resumable انجام می‌شود تا فایل‌های بزرگ کل حافظه PHP را پر نکنند.

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
    if (!openssl_sign($signingInput, $signature, $privateKeyPem, 'sha256WithRSAEncryption')) {
        throw new Exception('کلید خصوصی گوگل نامعتبره — GOOGLE_PRIVATE_KEY رو توی config.php چک کن');
    }

    $jwt = $signingInput . '.' . base64UrlEncode($signature);
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $curlError) {
        throw new Exception('اتصال به گوگل ناموفق بود: ' . $curlError);
    }

    $data = json_decode($response, true);
    if ($httpCode < 200 || $httpCode >= 300 || !isset($data['access_token'])) {
        throw new Exception('احراز هویت گوگل ناموفق بود: ' . $response);
    }
    return $data['access_token'];
}

function uploadFileToDrive(string $accessToken, string $folderId, string $tmpPath, string $fileName, string $mimeType): array {
    if (!is_readable($tmpPath)) {
        throw new Exception('فایل موقت آپلود قابل خواندن نیست. تنظیمات upload_tmp_dir سرور را بررسی کن.');
    }

    $fileSize = filesize($tmpPath);
    if ($fileSize === false) {
        throw new Exception('اندازه فایل قابل تشخیص نیست.');
    }

    // مرحله ۱: ساخت upload session در Google Drive
    $metadata = json_encode([
        'name' => $fileName,
        'parents' => [$folderId],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $uploadUrl = null;
    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $metadata,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            'Content-Type: application/json; charset=UTF-8',
            "X-Upload-Content-Type: $mimeType",
            "X-Upload-Content-Length: $fileSize",
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$uploadUrl) {
            $length = strlen($header);
            if (stripos($header, 'Location:') === 0) {
                $uploadUrl = trim(substr($header, strlen('Location:')));
            }
            return $length;
        },
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $curlError) {
        throw new Exception('ساخت نشست آپلود گوگل ناموفق بود: ' . $curlError);
    }
    if ($httpCode < 200 || $httpCode >= 300 || !$uploadUrl) {
        throw new Exception('گوگل نشست آپلود را ایجاد نکرد: HTTP ' . $httpCode . ' — ' . $response);
    }

    // مرحله ۲: ارسال مستقیم فایل از دیسک، بدون نگه‌داشتن کل فایل در RAM
    $handle = fopen($tmpPath, 'rb');
    if (!$handle) {
        throw new Exception('فایل برای ارسال به گوگل باز نشد.');
    }

    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_PUT => true,
        CURLOPT_INFILE => $handle,
        CURLOPT_INFILESIZE => $fileSize,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            "Content-Type: $mimeType",
            "Content-Length: $fileSize",
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_CONNECTTIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($handle);

    if ($response === false || $curlError) {
        throw new Exception('ارسال فایل به گوگل ناموفق بود: ' . $curlError);
    }

    $data = json_decode($response, true);
    if ($httpCode < 200 || $httpCode >= 300 || !isset($data['id'])) {
        throw new Exception('آپلود به درایو ناموفق بود: HTTP ' . $httpCode . ' — ' . $response);
    }

    return $data;
}

function makeDriveFilePublic(string $accessToken, string $fileId): void {
    $ch = curl_init("https://www.googleapis.com/drive/v3/files/$fileId/permissions");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode(['role' => 'reader', 'type' => 'anyone']),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $curlError) {
        throw new Exception('تنظیم دسترسی عمومی فایل ناموفق بود: ' . $curlError);
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        throw new Exception('گوگل اجازه عمومی فایل را نداد: HTTP ' . $httpCode . ' — ' . $response);
    }
}
