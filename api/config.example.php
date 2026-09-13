<?php
// این فایل رو بعد از خرید هاست، با اطلاعات واقعی cPanel/دیتابیستت پر کن.
// این اطلاعات هرگز نباید عمومی یا توی گیت‌هاب عمومی گذاشته بشن.

define('DB_HOST', 'localhost');       // معمولاً 'localhost' توی اکثر هاست‌های ایرانی
define('DB_NAME', 'REPLACE_ME');      // اسم دیتابیسی که توی cPanel ساختی
define('DB_USER', 'REPLACE_ME');      // یوزر دیتابیس
define('DB_PASS', 'REPLACE_ME');      // پسورد دیتابیس

// یه رشتهٔ تصادفی و طولانی بساز (مثلاً از یه سایت random string generator) و اینجا بذار.
// این برای امنیت سشن‌های ورود استفاده می‌شه.
define('SESSION_SECRET', 'REPLACE_WITH_A_LONG_RANDOM_STRING');

// === تنظیمات گوگل‌درایو (برای آپلود عکس/جزوه/صدا) ===
// راهنمای ساختشون توی README هست
define('GOOGLE_CLIENT_EMAIL', 'REPLACE_ME@your-project.iam.gserviceaccount.com');
define('GOOGLE_PRIVATE_KEY', "REPLACE_ME_WITH_FULL_PRIVATE_KEY_INCLUDING_BEGIN_END_LINES");
define('GOOGLE_DRIVE_FOLDER_ID', 'REPLACE_ME');
