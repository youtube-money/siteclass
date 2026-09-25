<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-helper.php';
require_once __DIR__ . '/google-oauth.php';
require_once __DIR__ . '/google-drive.php';

$me = requireLogin();
$input = getJsonInput();
$fileId = trim((string)($input['fileId'] ?? ''));
$filename = trim((string)($input['filename'] ?? 'upload'));
$size = (int)($input['size'] ?? 0);
$mimeType = trim((string)($input['mimeType'] ?? 'application/octet-stream'));

if ($fileId === '' || $size <= 0 || $size > 1024 * 1024 * 1024) jsonResponse(['error'=>'اطلاعات فایل نامعتبره.'],400);
if (!preg_match('/^[A-Za-z0-9_-]+$/',$fileId)) jsonResponse(['error'=>'شناسه فایل گوگل نامعتبره.'],400);

try {
    $accessToken = googleOAuthGetAccessToken();
    $url='https://www.googleapis.com/drive/v3/files/'.rawurlencode($fileId).'?fields=id,name,mimeType,size,webViewLink';
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>["Authorization: Bearer $accessToken"],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>30]);
    $response=curl_exec($ch);$error=curl_error($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($response===false||$error||$code<200||$code>=300)throw new Exception('فایل در Google Drive پیدا نشد: HTTP '.$code.' '.$error.' '.$response);
    $driveFile=json_decode($response,true);
    if(empty($driveFile['id']))throw new Exception('اطلاعات فایل گوگل ناقصه.');
    if(isset($driveFile['size'])&&(int)$driveFile['size']!==$size)throw new Exception('اندازه فایل کامل با اطلاعات ارسالی مطابقت ندارد.');

    makeDriveFilePublic($accessToken,$fileId);
    $directLink='/api/google-file.php?id='.rawurlencode($fileId);
    $viewLink=$driveFile['webViewLink']??'https://drive.google.com/file/d/'.$fileId.'/view';
    $pdo=getDB();
    $stmt=$pdo->prepare('INSERT INTO uploads (uploader_id, filename, drive_file_id, drive_view_link) VALUES (?, ?, ?, ?)');
    $stmt->execute([$me['id'],$filename?:($driveFile['name']??'upload'),$fileId,$viewLink]);
    jsonResponse(['success'=>true,'fileId'=>$fileId,'viewLink'=>$viewLink,'directLink'=>$directLink,'filename'=>$filename,'mimeType'=>$mimeType,'size'=>$size]);
} catch(Throwable $e){jsonResponse(['error'=>'ثبت فایل ناموفق بود: '.$e->getMessage()],502);}
