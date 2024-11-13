const Joi = require("joi")
const db = require("../modules/db");
const SessionObject = require('../modules/sessionObject');
const sessionsStore = require('../modules/sessionsStore');
const QuestionObject = require('../modules/QuestionObject');
const { get } = require("http");
const { type } = require("express/lib/response");
const uuidv4 = require('uuid').v4;

function getTrainingDashboard(req, res, next) {
    const getYearsQuery = 'SELECT year, COUNT(id_qcm) as count FROM qcm GROUP BY year ORDER BY year DESC';
    db.query(getYearsQuery, (err, years) => {
        if (err) {
            console.error('Erreur lors de la récupération des années', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        const getSessionNumberQuery = 'SELECT COUNT(id_session) as sessions_number, year FROM training_sessions WHERE id_user = ? GROUP BY year ORDER BY year DESC';
        db.query(getSessionNumberQuery, [req.session.userId], (err, sessions) => {
            if (err) {
                console.error('Erreur lors de la récupération des années', err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            years.forEach(year => {
                year.sessions_number = sessions.filter(session => session.year == year.year)[0]?.sessions_number || 0
            })

            const getDistinctAnsweredQuestionByYearQuery = 'SELECT COUNT(DISTINCT id_session_answer) as answered_questions_number, year FROM training_session_answers INNER JOIN training_sessions ON training_sessions.id_session = training_session_answers.id_session WHERE training_session_answers.id_session IN (SELECT id_session FROM training_sessions WHERE id_user = ?) GROUP BY year ORDER BY year DESC';
            db.query(getDistinctAnsweredQuestionByYearQuery, [req.session.userId], (err, answered_questions) => {
                if (err) {
                    console.error('Erreur lors de la récupération des années', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                years.forEach(year => {
                    year.answered_questions = answered_questions.filter(answered_question => answered_question.year == year.year)[0]?.answered_questions_number || 0
                })

                res.render("training_dashboard", { years });
            });
        });
    });
}

function startTrainingSession(req, res, next) {
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

    const query = 'SELECT * FROM qcm WHERE year = ? ORDER BY RAND() LIMIT ?';
    db.query(query, [safe_data.year, safe_data.amount], (err, qcms) => {
        if (err) {
            console.error('Erreur lors de la récupération des QCMs', err);
            return res.status(500).json({ message: 'Erreur serveur' });
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

        sessionsStore.addSession(new SessionObject(req.session.userId, sessionId, questions, year = safe_data.year, "training"));

        sessionsStore.displaySessionSumary();

        return res.status(200).json({ message: 'Success', sessionId: sessionId});
    });
}

function joinTrainingSession(req, res, next) {
    const sessionId = req.params.id;
    const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, req.session.userId);

    if (!session) {
        return res.redirect('/training');
    }

    //Check session type, session status, and if the session is active before sending page

    return res.render('training_session', { question: session.getActiveQuestion(), active: session.getActiveIndex(), answered: session.getIndexOfQuestionsWithAnswer(), questionNumber: session.getQuestionNumber(), sessionId: sessionId});
}


module.exports = {
    getTrainingDashboard,
    startTrainingSession,
    joinTrainingSession
}