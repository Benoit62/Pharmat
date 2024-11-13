const db = require("../modules/db");

function getHistoryPage(req, res, next)  {
    const queryTrainingHistory = 'SELECT * FROM training_sessions WHERE id_user = ? ORDER BY id_session DESC';
    db.query(queryTrainingHistory, req.session.userId, (err, training_history) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'historique des entrainements', err);
            return res.redirect("/error");
        }
        
        const queryRevisionHistory = 'SELECT count(qcm.id_qcm) as total, count(id_revision_answer) as answered, year FROM qcm LEFT JOIN revision_session_answers ON qcm.id_qcm = revision_session_answers.id_qcm AND revision_session_answers.id_revision IN (SELECT id_revision FROM revision_sessions WHERE id_user = ? AND active = 1) GROUP BY year ORDER BY year DESC';
        db.query(queryRevisionHistory, req.session.userId, (err, revision_history) => {
            if (err) {
                console.error('Erreur lors de la récupération de l\'historique des révisions', err);
                return res.redirect("/error");
            }
            res.render('history', { training_history, revision_history });
        });
    });
    // Logic for getting the history page
}

function getTrainingSessionHistoryPage(req, res) {
    const id = req.params.session;
    const queryGetSession = 'SELECT * FROM training_sessions WHERE id_session = ?';
    db.query(queryGetSession, id, (err, session) => {
        if (err) {
            console.error('Erreur lors de la récupération de la session', err);
            return res.redirect("/error");
        }

        if(session.length === 0) {
            return res.redirect("/history");
        }

        const queryGetAnswers = `
            SELECT * 
            FROM training_session_answers 
            INNER JOIN qcm ON training_session_answers.id_qcm = qcm.id_qcm
            WHERE training_session_answers.id_session = ?;
        `;
        db.query(queryGetAnswers, id, (err, questions) => {
            if (err) {
                console.error('Erreur lors de la récupération des réponses', err);
                return res.redirect("/error");
            }
        
            res.render('training_session_history', { questions, session:session[0] });
        });
    });
}

function getRevisionHistoryPage(req, res) {
    const year = req.params.year;
    // Logic for retrieving revision history
    const query = `
    SELECT revision_sessions.year, qcm.* , revision_session_answers.answer, revision_session_answers.score, revision_session_answers.errors
    FROM revision_sessions
    RIGHT JOIN qcm ON revision_sessions.year = qcm.year
    LEFT JOIN revision_session_answers ON revision_session_answers.id_qcm = qcm.id_qcm AND revision_sessions.id_revision = revision_session_answers.id_revision
    WHERE id_user = ? AND active = 1 AND revision_sessions.year = ?;
    `;
    db.query(query, [req.session.userId, year], (err, session) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'historique des révisions', err);
            return res.redirect("/error");
        }

        if(session.length === 0) {
            return res.redirect("/history");
        }

        const queryRevisionHistoryAdvancement = 'SELECT count(qcm.id_qcm) as total, count(id_revision_answer) as answered, ROUND(SUM(revision_session_answers.score), 2) as score, year FROM qcm LEFT JOIN revision_session_answers ON qcm.id_qcm = revision_session_answers.id_qcm AND revision_session_answers.id_revision IN (SELECT id_revision FROM revision_sessions WHERE id_user = ? AND active = 1) WHERE year = ? GROUP BY year ORDER BY year DESC';
        db.query(queryRevisionHistoryAdvancement, [req.session.userId, year], (err, revision_infos) => {
            if (err) {
                console.error('Erreur lors de la récupération de l\'historique des révisions', err);
                return res.redirect("/error");
            }

            console.log(revision_infos[0]);

            res.render('revision_history', { session, revision_infos: revision_infos[0] });
        });
    });
}

function getExamHistory(req, res) {
    // Logic for retrieving exam history
}

function addSessionToHistory(req, res) {
    // Logic for adding a new session to history
}

function addExamToHistory(req, res) {
    // Logic for adding a new exam to history
}

function deleteSessionFromHistory(req, res) {
    // Logic for deleting a session from history
}

function deleteExamFromHistory(req, res) {
    // Logic for deleting an exam from history
}

module.exports = {
    getHistoryPage,
    getTrainingSessionHistoryPage,
    getRevisionHistoryPage,
    getExamHistory,
    addSessionToHistory,
    addExamToHistory,
    deleteSessionFromHistory,
    deleteExamFromHistory
};