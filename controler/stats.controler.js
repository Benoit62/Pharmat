const db = require("../modules/db");

function getStats(req, res, next) {
    const queryPerf = 'SELECT * FROM training_sessions WHERE id_user = ? ORDER BY id_session ASC LIMIT 30';
    db.query(queryPerf, req.session.userId, (err, performance) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'historique', err);
            return res.redirect("/error");
        }

        const queryActivityLast7Days = `
            SELECT date, IFNULL(SUM(size), 0) as activity 
            FROM training_sessions 
            WHERE id_user = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
            GROUP BY date 
            ORDER BY id_session ASC
        `;
        db.query(queryActivityLast7Days, req.session.userId, (err, activity) => {
            if (err) {
                console.error('Erreur lors de la récupération de l\'historique', err);
                return res.redirect("/error");
            }

            const getAnsweredQuestionByYearQuery = 'SELECT COUNT(id_session_answer) as answered_questions_number, year FROM training_session_answers INNER JOIN training_sessions ON training_sessions.id_session = training_session_answers.id_session WHERE training_session_answers.id_session IN (SELECT id_session FROM training_sessions WHERE id_user = ?) GROUP BY year ORDER BY year DESC';
            db.query(getAnsweredQuestionByYearQuery, req.session.userId, (err, answerByYear) => {
                if (err) {
                    console.error('Erreur lors de la récupération des questions répondues', err);
                    return res.redirect("/error");
                }
                res.render('stats', { performance, activity, answerByYear });
            });
        });

        const queryLast7Days = 'SELECT * FROM training_sessions WHERE id_user = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY id_session ASC';
        db.query(queryLast7Days, req.session.userId, (err, last7Days) => {
            if (err) {
                console.error('Erreur lors de la récupération des derniers 7 jours', err);
                return res.redirect("/error");
            }
            // Continue with the rest of the code
        });

        
    });
    
};

// Export the statsController object
module.exports = {
    getStats
};