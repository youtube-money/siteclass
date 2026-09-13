-- این فایل رو بعد از schema.sql و schema-phase2-4.sql اجرا کن

-- === نقش‌ها و پروفایل ===
ALTER TABLE users
  ADD COLUMN avatar_emoji VARCHAR(10) DEFAULT '🙂',
  ADD COLUMN bio VARCHAR(255) DEFAULT NULL,
  ADD COLUMN theme_color VARCHAR(10) DEFAULT NULL;
-- role از قبل VARCHAR(20) بود؛ مقدار جدید 'special' هم توش قابل‌ذخیره‌ست، نیازی به ALTER جدا نداره

-- === کلیدهای API سراسری سایت (مدیریت‌شده توسط ادمین) ===
CREATE TABLE site_api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  is_assistant_key TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === دروس ===
CREATE TABLE lesson_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lesson_contents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT,
  file_link VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES lesson_subjects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === جزوه‌ها (کتاب/پودمان) ===
CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE book_chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  chapter_name VARCHAR(150) NOT NULL,
  chapter_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  chapter_id INT NOT NULL,
  uploader_id INT NOT NULL,
  note_type VARCHAR(10) NOT NULL, -- 'upload' | 'created'
  file_link VARCHAR(500) NULL,
  text_content MEDIUMTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (chapter_id) REFERENCES book_chapters(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === بازی‌ها: آپلود فایل (به‌جای فقط کد) + لیدربورد ===
ALTER TABLE student_games
  MODIFY html_content MEDIUMTEXT NULL,
  ADD COLUMN file_link VARCHAR(500) NULL;

CREATE TABLE game_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  game_key VARCHAR(50) NOT NULL, -- 'snake' | 'tetris' | 'number-guess' | 'student:<id>'
  score INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_game_scores_leaderboard ON game_scores (game_key, score DESC);

-- === شبکهٔ اجتماعی (مخفی، فقط نقش ویژه/ادمین) ===
CREATE TABLE social_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- === رفع اشکال (برای همه باز) ===
CREATE TABLE bug_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  reported_by INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reported_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bug_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bug_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bug_id) REFERENCES bug_reports(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
