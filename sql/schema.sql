-- کاربران
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student',  -- 'student' | 'admin'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- پیام‌های چت (گروهی و خصوصی) — ستون‌های media از الان اضافه شدن چون فاز بعدی لازمشون داریم
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NULL,          -- NULL یعنی پیام گروهی
  chat_type VARCHAR(10) NOT NULL, -- 'group' | 'private'
  content TEXT,
  media_url VARCHAR(500) NULL,    -- لینک مستقیم فایل روی گوگل‌درایو (فاز بعد)
  media_type VARCHAR(10) NULL,    -- 'image' | 'audio'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_messages_group ON messages (chat_type, created_at);
CREATE INDEX idx_messages_private ON messages (sender_id, recipient_id, created_at);

-- برنامهٔ کلاسی
CREATE TABLE schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week VARCHAR(20) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  time_slot VARCHAR(50),
  note VARCHAR(255),
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
