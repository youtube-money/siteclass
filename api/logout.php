<?php
require_once __DIR__ . '/session-helper.php';

startSecureSession();
$_SESSION = [];
session_destroy();

jsonResponse(['success' => true]);
