-- 002 — Pharmat 2 : intégrité (clés étrangères, unicité), préférences de courriel,
-- réinitialisation du mot de passe, mode examen, filtre par matière, sessions web en base.
-- Chaque instruction peut être rejouée sans effet (IF [NOT] EXISTS) : une migration
-- interrompue se relance telle quelle.

-- ---------- Comptes ----------
ALTER TABLE users
  MODIFY mail VARCHAR(190) NOT NULL,
  MODIFY password VARCHAR(100) NOT NULL,
  MODIFY confirm_id VARCHAR(36) NULL DEFAULT NULL,
  MODIFY last_login DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cree_le DATETIME NULL,
  ADD COLUMN IF NOT EXISTS notif_rappel TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notif_bilan TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reinit_empreinte CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reinit_expire DATETIME NULL,
  DROP COLUMN IF EXISTS phone;
-- Les SMS n'ont jamais fonctionné : le numéro de téléphone n'est plus collecté ni gardé.

ALTER TABLE users MODIFY cree_le DATETIME NULL DEFAULT CURRENT_TIMESTAMP;
-- Une adresse confirmée n'a plus d'identifiant de confirmation (l'ancienne valeur était '')
UPDATE users SET confirm_id = NULL WHERE confirm_id = '';
UPDATE users SET mail = LOWER(TRIM(mail));
ALTER TABLE users ADD UNIQUE INDEX IF NOT EXISTS uq_users_mail (mail);

-- ---------- Questions et matières ----------
-- Une question annulée au concours (correction « ANNULÉ ») est gardée mais n'entre plus
-- dans les séries.
ALTER TABLE qcm ADD COLUMN IF NOT EXISTS annulee TINYINT(1) NOT NULL DEFAULT 0;
UPDATE qcm SET annulee = 1, correct = '' WHERE correct NOT REGEXP '^[A-E](,[A-E]){0,4}$';
ALTER TABLE qcm
  MODIFY correct VARCHAR(9) NOT NULL,
  ADD INDEX IF NOT EXISTS ix_qcm_annee (year, number);

-- La catégorie vide (« ») était posée sur les questions sans matière : on la retire.
DELETE qc FROM qcms_categories qc
  LEFT JOIN categories c ON c.id_category = qc.category
  LEFT JOIN qcm q ON q.id_qcm = qc.qcm
  WHERE c.id_category IS NULL OR TRIM(c.name) = '' OR q.id_qcm IS NULL;
DELETE FROM categories WHERE TRIM(name) = '';
DELETE a FROM qcms_categories a
  JOIN qcms_categories b ON a.qcm = b.qcm AND a.category = b.category AND a.qcm_category > b.qcm_category;

ALTER TABLE categories ADD UNIQUE INDEX IF NOT EXISTS uq_categories_nom (name);
ALTER TABLE qcms_categories
  ADD UNIQUE INDEX IF NOT EXISTS uq_qcm_categorie (qcm, category),
  ADD INDEX IF NOT EXISTS ix_qc_categorie (category);
ALTER TABLE qcms_categories
  ADD CONSTRAINT fk_qc_qcm FOREIGN KEY IF NOT EXISTS (qcm) REFERENCES qcm (id_qcm) ON DELETE CASCADE,
  ADD CONSTRAINT fk_qc_categorie FOREIGN KEY IF NOT EXISTS (category) REFERENCES categories (id_category) ON DELETE CASCADE;

-- ---------- Séries d'entraînement et examens ----------
DELETE ts FROM training_sessions ts LEFT JOIN users u ON u.id_user = ts.id_user WHERE u.id_user IS NULL;
DELETE a FROM training_session_answers a
  LEFT JOIN training_sessions ts ON ts.id_session = a.id_session
  LEFT JOIN qcm q ON q.id_qcm = a.id_qcm
  WHERE ts.id_session IS NULL OR q.id_qcm IS NULL;

ALTER TABLE training_sessions
  MODIFY year INT NULL,
  ADD COLUMN IF NOT EXISTS mode ENUM('entrainement','examen') NOT NULL DEFAULT 'entrainement' AFTER id_user,
  ADD COLUMN IF NOT EXISTS id_category INT NULL,
  ADD COLUMN IF NOT EXISTS duree_s INT NULL,
  ADD COLUMN IF NOT EXISTS cree_le DATETIME NULL;
UPDATE training_sessions SET cree_le = date WHERE cree_le IS NULL;
ALTER TABLE training_sessions MODIFY cree_le DATETIME NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE training_sessions
  ADD INDEX IF NOT EXISTS ix_ts_utilisateur (id_user, date),
  ADD CONSTRAINT fk_ts_utilisateur FOREIGN KEY IF NOT EXISTS (id_user) REFERENCES users (id_user) ON DELETE CASCADE,
  ADD CONSTRAINT fk_ts_categorie FOREIGN KEY IF NOT EXISTS (id_category) REFERENCES categories (id_category) ON DELETE SET NULL;

ALTER TABLE training_session_answers
  ADD INDEX IF NOT EXISTS ix_tsa_qcm (id_qcm),
  ADD CONSTRAINT fk_tsa_serie FOREIGN KEY IF NOT EXISTS (id_session) REFERENCES training_sessions (id_session) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tsa_qcm FOREIGN KEY IF NOT EXISTS (id_qcm) REFERENCES qcm (id_qcm) ON DELETE CASCADE;

-- ---------- Révisions (une progression par année, « active » tant qu'on ne recommence pas) ----------
DELETE r FROM revision_sessions r LEFT JOIN users u ON u.id_user = r.id_user WHERE u.id_user IS NULL;
DELETE a FROM revision_session_answers a
  LEFT JOIN revision_sessions r ON r.id_revision = a.id_revision
  LEFT JOIN qcm q ON q.id_qcm = a.id_qcm
  WHERE r.id_revision IS NULL OR q.id_qcm IS NULL;
DELETE a FROM revision_session_answers a
  JOIN revision_session_answers b ON a.id_revision = b.id_revision AND a.id_qcm = b.id_qcm
  AND a.id_revision_answer > b.id_revision_answer;

-- « answered » et « total » se calculent : ils divergeaient de la réalité.
ALTER TABLE revision_sessions
  DROP COLUMN IF EXISTS answered,
  DROP COLUMN IF EXISTS total,
  ADD INDEX IF NOT EXISTS ix_rs_utilisateur (id_user, year, active),
  ADD CONSTRAINT fk_rs_utilisateur FOREIGN KEY IF NOT EXISTS (id_user) REFERENCES users (id_user) ON DELETE CASCADE;

ALTER TABLE revision_session_answers ADD COLUMN IF NOT EXISTS cree_le DATETIME NULL;
ALTER TABLE revision_session_answers MODIFY cree_le DATETIME NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE revision_session_answers
  ADD UNIQUE INDEX IF NOT EXISTS uq_rsa_question (id_revision, id_qcm),
  ADD INDEX IF NOT EXISTS ix_rsa_qcm (id_qcm),
  ADD CONSTRAINT fk_rsa_revision FOREIGN KEY IF NOT EXISTS (id_revision) REFERENCES revision_sessions (id_revision) ON DELETE CASCADE,
  ADD CONSTRAINT fk_rsa_qcm FOREIGN KEY IF NOT EXISTS (id_qcm) REFERENCES qcm (id_qcm) ON DELETE CASCADE;

-- ---------- Sessions de navigation (auparavant dans une seconde base) ----------
CREATE TABLE IF NOT EXISTS sessions_web (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  expire INT UNSIGNED NOT NULL,
  donnees MEDIUMTEXT NOT NULL,
  INDEX ix_sessions_expire (expire)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
