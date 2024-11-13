const db = require("../modules/db");
const sessionsStore = require('../modules/sessionsStore');
const JOI = require('joi');

module.exports = (io, socket) => {
    /*const sessionIdSchema = JOI.object({
        sessionId: JOI.string().guid({version: ['uuidv4']}).required().label("ID de la session")
    })
    .message({
        "string.base": "Le champ {#label} doit être une chaîne de caractères",
        "string.guid": "Le champ {#label} doit être un UUID",
        "string.empty": "Le champ {#label} ne doit pas être vide",
        "any.required": "Le champ {#label} est requis",
        "string.length": "Le champ {#label} doit être de taille 1",
        "string.valid": "La réponse doit être une lettre entre A et E",
        "array.base": "Le champ {#label} doit être un tableau",
        "array.unique": "Le champ {#label} doit être unique",
        "array.min": "Le champ {#label} doit contenir au moins une lettre",
        "array.max": "Le champ {#label} doit contenir au maximum cinq lettres",
        "number.base": "Le champ {#label} doit être un nombre",
        "number.min": "Le champ {#label} doit être supérieur à 0",
    });*/
    
    
    //answer: JOI.array().items(JOI.string().length(1).valid('A', 'B', 'C', 'D', 'E')).min(1).max(5).unique().required().label("Réponse"),
    //questionIndex: JOI.number().required().label("Index de la question"),
    
    /*const extendedSchema = sessionIdSchema.append({
        questionIndex: JOI.number().min(0).required().label("Index de la question")
    })
    
    const moreExtendedSchema = extendedSchema.append({
        answer: JOI.array().items(JOI.string().length(1).valid('A', 'B', 'C', 'D', 'E')).min(1).max(5).unique().required().label("Réponse")
    })*/


    function sender(session, message = null) {
        if (session.getStatus() == "active"){
            socket.emit("session:newQuestion", session.getActiveQuestion().reduceToArray(), session.getActiveIndex());
            socket.emit("session:updateOverlay", session.getNumberOfQuestionsAnswered(), session.getActiveIndex(), session.getIndexOfQuestionsWithAnswer())
        }

        if (session.checkfinishedSession() && session.getStatus() == "active"){
            socket.emit("session:finished");
        }

        if(message) {
            socket.emit("session:message", message);
        }

        if (session.getStatus() == "ended"){
            socket.emit("session:updateEndgameOverlay", session.getErrorNumber(), session.getAllQuestionsScore(), session.getQuestionScore(), session.getActiveIndex(), session.getSessionScore(), session.getMaxScore());
            socket.emit("session:seeResult", session.getActiveQuestion().reduceToArray(), session.getActiveIndex());
        }
    }
    const joinSession = (sessionId) => {
        console.log("Session joined", sessionId);

        const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, socket.handshake.session.userId);

        if (!session) {
            console.log("Session not found, function aborted");
            return socket.emit("session:error", "Session not found");
        }

        sender(session);

        // Check if session is ended when user joins
        if(session.getStatus() == "ended") {
            socket.emit("session:ended");
        }
    }
    
    const answerQuestion = (answer, questionIndex, sessionId) => {
        /*const {error, value:data} = schema.validate({answer, questionIndex, sessionId});
        if (error) {
            return socket.emit("session:error", error.details[0].message);
        }*/

        console.log("Answer received on socket handler", answer, questionIndex, sessionId);

        const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, socket.handshake.session.userId);

        if (!session) {
            console.log("Session not found, function aborted");
            return socket.emit("session:error", "Session not found");
        }

        const message = session.addUserAnswer(answer, questionIndex) || null;

        sender(session, message);
    }

    const chooseQuestion = (questionIndex, sessionId) => {
        console.log("Question chosen on socket handler", questionIndex, sessionId);

        const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, socket.handshake.session.userId);

        if (!session) {
            console.log("Session not found, function aborted");
            return socket.emit("session:error", "Session not found");
        }

        session.setActiveIndex(questionIndex);

        sender(session);
    }

    const terminateSession = (sessionId) => {
        console.log("Session ended", sessionId);

        const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, socket.handshake.session.userId);

        if (!session) {
            console.log("Session not found, function aborted");
            return socket.emit("session:error", "Session not found");
        }

        if(session.getNumberOfQuestionsAnswered() < session.getQuestionNumber()) {
            return socket.emit("session:error", "Vous devez répondre à toutes les questions avant de terminer la session");
        }

        session.endSession();

        socket.emit("session:ended");

        sender(session);
    }

    const quitSession = () => {

        const sessions = sessionsStore.getSessionByUserId(socket.handshake.session.userId);

        if (!sessions) {
            console.log("Session not found, function aborted");
            return socket.emit("session:error", "Sessions not found");
        }

        sessions.forEach((session) => {
            sessionsStore.removeSession(session.getSessionID());
        });
    }

    const saveSession = (sessionId) => {
        
        const session = sessionsStore.getSessionBySessionIdAndUserId(sessionId, socket.handshake.session.userId);

        const type = session.getSessionType();
        console.log("Session type", type);
        if(type !== "training" && type !== "revision") {
            console.error("Invalid session type", type);
            return socket.emit("session:error", "Type de session invalide");
        }

        if(type === "training") {
            const sessionData = {
                id_user: session.getUserID(),
                size: session.getQuestionNumber(),
                score: session.getSessionScore(),
                date: new Date(),
                year: session.getYear()
            }
            
            const queryInsertSession = "INSERT INTO training_sessions SET ?";
            db.query(queryInsertSession, sessionData, (err, insertedSession) => {
                if (err) {
                    console.error("Error saving session", err);
                    return socket.emit("session:error", "Erreur lors de la sauvegarde de la session");
                }
    
                const queryInsertAnswers = "INSERT INTO training_session_answers (id_session, id_qcm, answer, score, errors_number) VALUES ?";
                const answers = session.getAnswers().map((answer) => [insertedSession.insertId, answer.id_qcm, answer.answers.join(","), answer.score, answer.errors_number]);
                console.log(answers)
                db.query(queryInsertAnswers, [answers], (err, insertedSessionAnswer) => {
                    if (err) {
                        console.error("Error saving answers", err);
                        return socket.emit("session:error", "Erreur lors de la sauvegarde des réponses");
                    }
    
                    sessionsStore.removeSession(session.getSessionID());
    
                    socket.emit("session:saved", "Session sauvegardée avec succès", type, insertedSession.insertId);
                });
    
            });
        }
        if(type === "revision") {
            const getRevisionSession = "SELECT * FROM revision_sessions WHERE id_user = ? AND year = ? AND active = 1";
            db.query(getRevisionSession, [session.getUserID(), session.getYear()], (err, revisionSession) => {
                if (err) {
                    console.error("Error getting revision session", err);
                    return socket.emit("session:error", "Erreur lors de la récupération de la session");
                }

                if(revisionSession.length <= 0) {
                    return socket.emit("session:error", "Session de révision non trouvée dans la base de donnée");
                }

                const totalAnswered = session.getQuestionNumber() + revisionSession[0].answered;

                const queryUpdateRevisionSession = "UPDATE revision_sessions SET answered = ? WHERE id_revision = ?";
                db.query(queryUpdateRevisionSession, [totalAnswered, revisionSession[0].id_revision], (err, updatedRevisionSession) => {
                    if (err) {
                        console.error("Error updating revision session", err);
                        return socket.emit("session:error", "Erreur lors de la mise à jour de la session de révision");
                    }
        
                    const queryInsertAnswers = "INSERT INTO revision_session_answers (id_revision, id_qcm, answer, score, errors) VALUES ?";
                    const answers = session.getAnswers().map((answer) => [revisionSession[0].id_revision, answer.id_qcm, answer.answers.join(","), answer.score, answer.errors_number]);
                    db.query(queryInsertAnswers, [answers], (err, insertedSessionAnswer) => {
                        if (err) {
                            console.error("Error saving answers", err);
                            return socket.emit("session:error", "Erreur lors de la sauvegarde des réponses");
                        }
        
                        sessionsStore.removeSession(session.getSessionID());
        
                        socket.emit("session:saved", "Session sauvegardée avec succès", type);
                    });
                });
            });
        }
        
    }
  
    socket.on("session:join", joinSession);
    socket.on("session:answer", answerQuestion);
    socket.on("session:chooseQuestion", chooseQuestion);
    socket.on("session:terminate", terminateSession);
    socket.on("session:quit", quitSession);
    socket.on("session:save", saveSession);
}