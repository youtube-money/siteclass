-- بعد از schema-phase5.sql اجرا کن

-- به‌جای چک‌باکس is_assistant_key، هر کلید یه نقش مشخص داره
ALTER TABLE site_api_keys
  DROP COLUMN is_assistant_key,
  ADD COLUMN key_role VARCHAR(20) NOT NULL DEFAULT 'assistant'; -- 'assistant' | 'chatbot' | 'coding'

-- کاربر مجازیِ ربات چت (پیام‌های بات از این حساب فرستاده می‌شه)
-- password_hash عمداً یه مقدار نامعتبره که هیچ رمزی باهاش match نمی‌شه، یعنی هیچ‌کس نمی‌تونه باهاش لاگین کنه
INSERT INTO users (username, display_name, password_hash, role, avatar_emoji)
VALUES ('classroom_bot', 'دستیار کلاس 🤖', 'NO_LOGIN_ACCOUNT', 'bot', '🤖');

-- حافظهٔ مشترک برای هر دانش‌آموز، برای وقتی که با کلید شخصی خودش با AI صحبت می‌کنه
-- (مشترک بین همهٔ پروژه‌هاش، نه جدا برای هرکدوم)
CREATE TABLE student_ai_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role VARCHAR(10) NOT NULL, -- 'user' | 'model'
  message MEDIUMTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
