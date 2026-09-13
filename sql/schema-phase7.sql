-- بعد از schema-phase6.sql اجرا کن

-- ذخیرهٔ کدی که هر دانش‌آموز برای هر پروژه می‌نویسه
CREATE TABLE student_project_code (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NOT NULL,
  code MEDIUMTEXT,
  language VARCHAR(20) NOT NULL DEFAULT 'python',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_project_code (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
