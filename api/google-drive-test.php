<?php
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';

requireLogin();
header('Content-Type: application/json; charset=UTF-8');

$fileId = trim((string)($_GET['id'] ?? ''));
if ($fileId === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'step'=>'input','error'=>'fileId نامعتبر است'], JSON_UNESCAPED_UNICODE);
    exit;
}

function gd_test(string $url, string $token, array $headers=[]): array {
    $ch=curl_init($url);
    curl_setopt_array($ch,[
        CURLOPT_HTTPHEADER=>array_merge(['Authorization: Bearer '.$token],$headers),
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_FOLLOWLOCATION=>true,
        CURLOPT_TIMEOUT=>30,
        CURLOPT_CONNECTTIMEOUT=>10,
    ]);
    $body=curl_exec($ch);
    $error=curl_error($ch);
    $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    $type=(string)curl_getinfo($ch,CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    return ['code'=>$code,'type'=>$type,'error'=>$error,'body'=>$body];
}

try {
    $token=googleOAuthGetAccessToken();
    if (!$token) throw new Exception('Access token دریافت نشد');

    $meta=gd_test('https://www.googleapis.com/drive/v3/files/'.rawurlencode($fileId).'?fields=id,name,mimeType,size,webViewLink,webContentLink',$token);
    if($meta['code']<200 || $meta['code']>=300){
        echo json_encode(['ok'=>false,'step'=>'metadata','http'=>$meta['code'],'curl_error'=>$meta['error'],'google_response'=>json_decode((string)$meta['body'],true) ?: substr((string)$meta['body'],0,1000)],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT); exit;
    }
    $info=json_decode((string)$meta['body'],true);

    $media=gd_test('https://www.googleapis.com/drive/v3/files/'.rawurlencode($fileId).'?alt=media',$token,['Range: bytes=0-1023']);
    echo json_encode([
        'ok'=>$media['code']===200 || $media['code']===206,
        'step'=>'media',
        'metadata'=>['id'=>$info['id']??null,'name'=>$info['name']??null,'mimeType'=>$info['mimeType']??null,'size'=>$info['size']??null],
        'media_http'=>$media['code'],
        'media_content_type'=>$media['type'],
        'media_bytes_received'=>strlen((string)$media['body']),
        'curl_error'=>$media['error'],
        'message'=>($media['code']===200||$media['code']===206)?'Google Drive → PHP موفق است.':'Google Drive فایل را به PHP تحویل نداده است.',
    ],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
} catch(Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'step'=>'oauth/php','error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
}
