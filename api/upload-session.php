<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session-helper.php';

requireLogin();
$input = getJsonInput();
$name = trim((string)($input['name'] ?? ''));
$mimeType = trim((string)($input['mimeType'] ?? 'application/octet-stream'));
$size = (int)($input['size'] ?? 0);

if ($name === '' || $size <= 0) {
    jsonResponse(['error' => 'نام یا اندازه فایل نامعتبره.'], 400);
}
if ($size > 1024 * 1024 * 1024) {
    jsonResponse(['error' => 'حجم فایل بیشتر از حد مجاز ۱ گیگابایت است.'], 413);
}
if (strlen($name) > 240) $name = substr($name, 0, 240);
if (!preg_match('/^[\w.\- ()\[\]آ-ی]+$/u', $name)) {
    $name = preg_replace('/[^\p{L}\p{N}._()\[\] -]/u', '_', $name) ?: 'upload.bin';
}

function b64url(string $data): string { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }

try {
    $now = time();
    $header = b64url(json_encode(['alg'=>'RS256','typ'=>'JWT']));
    $claim = b64url(json_encode([
        'iss' => GOOGLE_CLIENT_EMAIL,
        'scope' => 'https://www.googleapis.com/auth/drive.file',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ]));
    $inputJwt = "$header.$claim";
    if (!openssl_sign($inputJwt, $signature, GOOGLE_PRIVATE_KEY, 'sha256WithRSAEncryption')) {
        throw new Exception('کلید خصوصی گوگل نامعتبره.');
    }
    $jwt = $inputJwt . '.' . b64url($signature);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>http_build_query([
        'grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$jwt
    ]), CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>30]);
    $response = curl_exec($ch); $error = curl_error($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($response === false || $error || $code < 200 || $code >= 300) throw new Exception('دریافت توکن گوگل ناموفق بود: '.$error.' '.$response);
    $token = json_decode($response, true)['access_token'] ?? null;
    if (!$token) throw new Exception('توکن گوگل دریافت نشد.');

    $metadata = json_encode(['name' => time().'_'.$name, 'parents' => [GOOGLE_DRIVE_FOLDER_ID]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $sessionUrl = null;
    $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink');
    curl_setopt_array($ch, [
        CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>$metadata,
        CURLOPT_HTTPHEADER=>[
            "Authorization: Bearer $token", 'Content-Type: application/json; charset=UTF-8',
            "X-Upload-Content-Type: $mimeType", "X-Upload-Content-Length: $size"
        ], CURLOPT_RETURNTRANSFER=>true, CURLOPT_HEADERFUNCTION=>function($curl,$header) use (&$sessionUrl){
            if (stripos($header,'Location:') === 0) $sessionUrl = trim(substr($header, strlen('Location:'))); return strlen($header);
        }, CURLOPT_TIMEOUT=>30
    ]);
    $response = curl_exec($ch); $error = curl_error($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($response === false || $error || $code < 200 || $code >= 300 || !$sessionUrl) throw new Exception('نشست آپلود گوگل ساخته نشد: HTTP '.$code.' '.$error.' '.$response);

    jsonResponse(['success'=>true,'uploadUrl'=>$sessionUrl,'name'=>$name,'size'=>$size,'mimeType'=>$mimeType]);
} catch (Throwable $e) {
    jsonResponse(['error'=>'شروع آپلود ناموفق بود: '.$e->getMessage()], 502);
}
