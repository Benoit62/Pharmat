const Joi = require("joi")
const db = require("../modules/db");
const SessionObject = require('../modules/sessionObject');
const sessionsStore = require('../modules/sessionsStore');
const QuestionObject = require('../modules/QuestionObject');
const { get } = require("http");
const { type } = require("express/lib/response");
const uuidv4 = require('uuid').v4;

function getRevisionDashboard(req, res, next) {
    const getYearsQuery = 'SELECT year, COUNT(id_qcm) as count FROM qcm GROUP BY year ORDER BY year DESC';
    db.query(getYearsQuery, (err, years) => {
        if (err) {
            console.error('Erreur lors de la récupération des années', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (years.length <= 0) {
            return res.render("revision_dashboard", { years: [] });
        }

        const getSessionsQuery = `SELECT ts.* FROM revision_sessions ts JOIN ( SELECT year, MAX(id_revision) AS latest_session_id FROM revision_sessions WHERE id_user = ? GROUP BY year ) latest_sessions ON ts.year = latest_sessions.year AND ts.id_revision = latest_sessions.latest_session_id WHERE id_user = ? AND active = 1;`;
        db.query(getSessionsQuery, [req.session.userId, req.session.userId], (err, sessions) => {
            if (err) {
                console.error('Erreur lors de la récupération des session de révision', err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            years.forEach(year => {
                year.answered = sessions.filter(session => session.year == year.year)[0]?.answered || 0;
            })

            /*const getDistinctAnsweredQuestionByYearAndBySessionQuery = `
            SELECT GROUP_CONCAT(score SEPARATOR ', ') as answers_score, year 
            FROM revision_session_answers 
            INNER JOIN revision_sessions 
                ON revision_sessions.id_revision = revision_session_answers.id_revision 
            WHERE revision_session_answers.id_revision IN (SELECT id_revision FROM revision_sessions WHERE id_user = ?) 
            GROUP BY year 
            ORDER BY year DESC; `;*/
            const getAnsweredQuestions = `
            SELECT id_qcm, score, year, revision_sessions.id_revision
            FROM revision_session_answers
            INNER JOIN revision_sessions
                ON revision_sessions.id_revision = revision_session_answers.id_revision
            WHERE revision_sessions.id_user = ? AND revision_sessions.active = 1;`;
            db.query(getAnsweredQuestions, [req.session.userId], (err, answered_questions) => {
                if (err) {
                    console.error('Erreur lors de la récupération des années', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                const getAllQCMs = `
                SELECT id_qcm, year
                FROM qcm`;
                db.query(getAllQCMs, [req.session.userId], (err, qcms) => {
                    if (err) {
                        console.error('Erreur lors de la récupération des années', err);
                        return res.status(500).json({ message: 'Erreur serveur' });
                    }

                    years.forEach(year => {

                        const yearQCMS = qcms.filter(qcm => qcm.year == year.year);
                        const yearAnsweredQuestions = answered_questions.filter(answered_question => answered_question.year == year.year);

                        year.answered_questions = yearQCMS.map(qcm => {
                            const answeredQuestion = yearAnsweredQuestions.find(answered_question => answered_question.id_qcm == qcm.id_qcm);
                            return answeredQuestion ? answeredQuestion.score : -1
                        });
                    });

                    years.forEach(year => {
                        year.score = Math.round(year.answered_questions.filter(answered_question => answered_question >= 0).reduce((acc, score) => acc + score, 0) * 100) / 100;
                    });


                    const queryGetOldRevisionSessions = 'SELECT revision_sessions.*, ROUND(SUM(revision_session_answers.score), 2) as score FROM revision_sessions RIGHT JOIN revision_session_answers ON revision_sessions.id_revision = revision_session_answers.id_revision WHERE id_user = ? AND active = 0 GROUP BY revision_sessions.id_revision ORDER BY date DESC; ';
                    db.query(queryGetOldRevisionSessions, [req.session.userId], (err, oldRevisionSessions) => {
                        if (err) {
                            console.error('Erreur lors de la récupération des sessions de révision', err);
                            return res.status(500).json({ message: 'Erreur serveur' });
                        }

                        years.forEach(year => {
                            year.old_sessions = oldRevisionSessions.filter(session => session.year == year.year);
                        });

                        res.render("revision_dashboard", { years });
                    });
                });
            });
        });
    });
}

function startRevisionSession(req, res, next) {
    const data = req.body;

    const currentYear = new Date().getFullYear();
    const sessionSchema = Joi.object({
        year: Joi.number().required().label('Année').max(parseInt(currentYear)),
        amount: Joi.number().min(5).max(5000).required().multiple(5).label('Nombre de questions'),
    })
    .messages({
        'number.base': 'Le champ {#label} doit être un nombre',
        'number.empty': 'Le champ {#label} ne doit pas être vide',
        'any.required': 'Le champ {#label} est obligatoire',
        'number.min': 'Le champ {#label} doit être supérieur à 5',
        'number.multiple': 'Le champ {#label} doit être un multiple de 5',
        'number.max': 'Le champ {#label} doit être inférieur ou égal à l\'année en cours',
    });

    const { error, value:safe_data } = sessionSchema.validate(data);

    if(error){
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') });
    }

    const queryRevisionSessions = 'SELECT * FROM revision_sessions WHERE year = ? AND id_user = ? AND active = 1';
    db.query(queryRevisionSessions, [safe_data.year, req.session.userId], (err, revisionSessions) => {
        if (err) {
            console.error('Erreur lors de la récupération des sessions de révision', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if(revisionSessions.length <= 0) {
            const queryTotalQCMs = 'SELECT COUNT(id_qcm) as total FROM qcm WHERE year = ?';
            db.query(queryTotalQCMs, [safe_data.year], (err, totalQCMs) => {
                if (err) {
                    console.error('Erreur lors de la récupération du nombre total de QCMs', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                const insertRevisionSession = 'INSERT INTO revision_sessions (id_user, date, year, total) VALUES (?, ?, ?, ?)';
                db.query(insertRevisionSession, [req.session.userId, new Date().toISOString().split('T')[0], safe_data.year, totalQCMs[0].total], (err, resultInsert) => {
                    if (err) {
                        console.error('Erreur lors de la création de la session de révision', err);
                        return res.status(500).json({ message: 'Erreur serveur' });
                    }

                    const queryQCMs = 'SELECT * FROM qcm WHERE year = ? AND id_qcm NOT IN (SELECT id_qcm FROM revision_session_answers WHERE id_revision = ?) LIMIT ?';
                    db.query(queryQCMs, [safe_data.year, resultInsert.insertId, safe_data.amount], (err, qcms) => {
                        if (err) {
                            console.error('Erreur lors de la récupération des QCMs', err);
                            return res.status(500).json({ message: 'Erreur serveur' });
                        }

                        if(qcms.length <= 0) {
                            return res.status(400).json({ message: 'Vous avez déjà répondu à toutes les questions de révision de cette année' });
                        }

                        const answers = qcms.map(qcm => {
                            return new Map([
                                ['A', qcm.A],
                                ['B', qcm.B],
                                ['C', qcm.C],
                                ['D', qcm.D],
                                ['E', qcm.E]
                            ]);
                        });

                        const questions = qcms.map((qcm, index) => new QuestionObject(qcm.id_qcm, qcm.year, qcm.type, qcm.number, qcm.question, answers[index], qcm.correct.split(',')));

                        const sessionId = uuidv4();

                        sessionsStore.addSession(new SessionObject(req.session.userId, sessionId, questions, year = safe_data.year, "revision"));

                        sessionsStore.displaySessionSumary();

                        return res.status(200).json({ message: 'Success', sessionId: sessionId});
                    });
                });
            });
        }
        else {

            const queryQCMs = 'SELECT * FROM qcm WHERE year = ? AND id_qcm NOT IN (SELECT id_qcm FROM revision_session_answers WHERE id_revision IN (SELECT id_revision FROM revision_sessions WHERE year = ? AND id_user = ? AND active = 1)) LIMIT ?';
            db.query(queryQCMs, [safe_data.year, safe_data.year, req.session.userId, safe_data.amount], (err, qcms) => {
                if (err) {
                    console.error('Erreur lors de la récupération des QCMs', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                if(qcms.length <= 0) {
                    return res.status(400).json({ message: 'Vous avez déjà répondu à toutes les questions de révision de cette année' });
                }

                const answers = qcms.map(qcm => {
                    return new Map([
                        ['A', qcm.A],
                        ['B', qcm.B],
                        ['C', qcm.C],
                        ['D', qcm.D],
                        ['E', qcm.E]
                    ]);
                });

                const questions = qcms.map((qcm, index) => new QuestionObject(qcm.id_qcm, qcm.year, qcm.type, qcm.number, qcm.question, answers[index], qcm.correct.split(',')));

                const sessionId = uuidv4();

                sessionsStore.addSession(new SessionObject(req.session.userId, sessionId, questions, year = safe_data.year, "revision"));

                sessionsStore.displaySessionSumary();

                return res.status(200).json({ message: 'Success', sessionId: sessionId});
            });
        }
    });
}

function joinRevisionSession(req, res, next) {
    const sessionId = req.params.id;
    const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, req.session.userId);

    if (!session) {
        return res.redirect('/revision');
    }


    return res.render('training_session', { question: session.getActiveQuestion(), active: session.getActiveIndex(), answered: session.getIndexOfQuestionsWithAnswer(), questionNumber: session.getQuestionNumber(), sessionId: sessionId});
}


function resetRevisionSession(req, res, next) {
    const data = req.body;

    const currentYear = new Date().getFullYear();
    const sessionSchema = Joi.object({
        year: Joi.number().required().label('Année').max(parseInt(currentYear)),
    })
    .messages({
        'number.base': 'Le champ {#label} doit être un nombre',
        'number.empty': 'Le champ {#label} ne doit pas être vide',
        'any.required': 'Le champ {#label} est obligatoire',
    });

    const { error, value:safe_data } = sessionSchema.validate(data);

    if(error){
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') });
    }

    const queryRevisionSessions = 'SELECT * FROM revision_sessions WHERE year = ? AND id_user = ? AND active = 1';
    db.query(queryRevisionSessions, [safe_data.year, req.session.userId], (err, revisionSessions) => {
        if (err) {
            console.error('Erreur lors de la récupération des sessions de révision', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if(revisionSessions.length <= 0) {
            return res.status(400).json({ message: 'Aucune session de révision active pour cette année' });
        }
        else {
            const updateRevisionSession = 'UPDATE revision_sessions SET active = 0 WHERE id_revision = ? AND id_user = ?';
            db.query(updateRevisionSession, [revisionSessions[0].id_revision, req.session.userId], (err, resultUpdate) => {
                if (err) {
                    console.error('Erreur lors de la mise à jour de la session de révision', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                return res.status(200).json({ message: 'Success'});
            });
        }
    });
}


module.exports = {
    getRevisionDashboard,
    startRevisionSession,
    joinRevisionSession,
    resetRevisionSession
}