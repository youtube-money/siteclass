<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('SITECLASSSESSID');
    $sessionsDir = dirname(__DIR__) . '/.sessions';
    if (!is_dir($sessionsDir)) @mkdir($sessionsDir, 0700, true);
    if (is_dir($sessionsDir)) {
        @chmod($sessionsDir, 0700);
        if (!file_exists($sessionsDir . '/.htaccess')) @file_put_contents($sessionsDir . '/.htaccess', "Require all denied\nDeny from all\n");
        if (!file_exists($sessionsDir . '/index.php')) @file_put_contents($sessionsDir . '/index.php', "<?php http_response_code(403); exit;\n");
    }
    if (is_dir($sessionsDir) && is_writable($sessionsDir)) session_save_path($sessionsDir);
    $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
    ini_set('session.use_cookies', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $isHttps ? '1' : '0');
    ini_set('session.cookie_samesite', 'Lax');
    session_set_cookie_params(['lifetime'=>60*60*24*30,'path'=>'/','httponly'=>true,'samesite'=>'Lax','secure'=>$isHttps]);
    session_start();
}

function base64UrlEncode(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
function base64UrlDecode(string $value): string|false { $padding = strlen($value) % 4; if ($padding) $value .= str_repeat('=', 4-$padding); return base64_decode(strtr($value, '-_', '+/'), true); }
function makeAuthToken(int $userId): string { $expires=time()+60*60*24*30; $payload=$userId.'.'.$expires; return base64UrlEncode($payload.'.'.hash_hmac('sha256',$payload,SESSION_SECRET)); }
function setAuthCookie(int $userId): void { $isHttps=!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off'; setcookie('SITECLASS_AUTH',makeAuthToken($userId),['expires'=>time()+60*60*24*30,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']); }
function clearAuthCookie(): void { $isHttps=!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off'; setcookie('SITECLASS_AUTH','',['expires'=>time()-42000,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']); }

function getUserFromToken(string $token): ?array {
    $decoded=base64UrlDecode($token); if($decoded===false)return null;
    $parts=explode('.',$decoded); if(count($parts)!==3)return null;
    [$userId,$expires,$signature]=$parts;
    if(!ctype_digit($userId)||!ctype_digit($expires)||(int)$expires<time())return null;
    $payload=$userId.'.'.$expires; $expected=hash_hmac('sha256',$payload,SESSION_SECRET);
    if(!hash_equals($expected,$signature))return null;
    $stmt=getDB()->prepare('SELECT id, username, display_name, role FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([(int)$userId]); $user=$stmt->fetch(); return $user?:null;
}

function getAuthorizationHeader(): string {
    $header=$_SERVER['HTTP_AUTHORIZATION']??'';
    if($header!=='') return $header;
    if(isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && $_SERVER['REDIRECT_HTTP_AUTHORIZATION']!=='') return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if(function_exists('getallheaders')) {
        $headers=getallheaders();
        foreach($headers as $name=>$value) if(strcasecmp($name,'Authorization')===0) return (string)$value;
    }
    if(function_exists('apache_request_headers')) {
        $headers=apache_request_headers();
        foreach($headers as $name=>$value) if(strcasecmp($name,'Authorization')===0) return (string)$value;
    }
    return '';
}

function getUserFromAuthSources(): ?array {
    $header=getAuthorizationHeader();
    if(preg_match('/^Bearer\s+(.+)$/i',$header,$m)) { $user=getUserFromToken(trim($m[1])); if($user)return $user; }
    $cookie=$_COOKIE['SITECLASS_AUTH']??'';
    if($cookie!=='') { $user=getUserFromToken($cookie); if($user)return $user; }
    return null;
}

function jsonResponse($data,int $status=200):void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0'); echo json_encode($data,JSON_UNESCAPED_UNICODE); exit; }
function requireLogin():array {
    startSecureSession();
    if(isset($_SESSION['user_id'])) return ['id'=>(int)$_SESSION['user_id'],'username'=>(string)($_SESSION['username']??''),'display_name'=>(string)($_SESSION['display_name']??$_SESSION['username']??''),'role'=>(string)($_SESSION['role']??'student')];
    $user=getUserFromAuthSources();
    if($user){ $_SESSION['user_id']=(int)$user['id']; $_SESSION['username']=$user['username']; $_SESSION['display_name']=$user['display_name']; $_SESSION['role']=$user['role']; return ['id'=>(int)$user['id'],'username'=>(string)$user['username'],'display_name'=>(string)$user['display_name'],'role'=>(string)$user['role']]; }
    jsonResponse(['error'=>'وارد نشدی'],401);
}
function getJsonInput():array { $data=json_decode(file_get_contents('php://input'),true); return is_array($data)?$data:[]; }
function requireRole(array $allowedRoles):array { $me=requireLogin(); if(!in_array($me['role'],$allowedRoles,true))jsonResponse(['error'=>'دسترسی نداری'],403); return $me; }
