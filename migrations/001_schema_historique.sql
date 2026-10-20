-- 001 — le schéma de l'ancienne application (Pharmat 1), tel qu'il était en production.
-- Sans effet sur une base importée de l'ancien serveur ; crée les tables sur une base vide.
-- La suite (002…) le transforme.

CREATE TABLE IF NOT EXISTS users (
  id_user INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  mail TEXT NOT NULL,
  password TEXT NOT NULL,
  confirm_id TEXT NOT NULL,
  status ENUM('ADMIN','USER') NOT NULL DEFAULT 'USER',
  last_login DATE NOT NULL,
  phone VARCHAR(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qcm (
  id_qcm INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  type ENUM('QCM','QCS') NOT NULL,
  number INT NOT NULL,
  question TEXT NOT NULL,
  A TEXT NOT NULL,
  B TEXT NOT NULL,
  C TEXT NOT NULL,
  D TEXT NOT NULL,
  E TEXT NOT NULL,
  correct TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id_category INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qcms_categories (
  qcm_category INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  qcm INT NOT NULL,
  category INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS training_sessions (
  id_session INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_user INT NOT NULL,
  size INT NOT NULL,
  score FLOAT NOT NULL,
  date DATE NOT NULL,
  year INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS training_session_answers (
  id_session_answer INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_session INT NOT NULL,
  id_qcm INT NOT NULL,
  answer VARCHAR(20) NOT NULL,
  score FLOAT NOT NULL,
  errors_number INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revision_sessions (
  id_revision INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_user INT NOT NULL,
  date DATE NOT NULL,
  year INT NOT NULL,
  answered INT NOT NULL DEFAULT 0,
  total INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revision_session_answers (
  id_revision_answer INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_revision INT NOT NULL,
  id_qcm INT NOT NULL,
  answer VARCHAR(20) NOT NULL,
  score FLOAT NOT NULL,
  errors INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
