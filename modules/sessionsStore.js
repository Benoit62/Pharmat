const sessionObject = require('./sessionObject');

const sessionArray = new Map();

function addSession(session) {
    const activeSessionId = isUserInSession(session.getUserID());
    if (activeSessionId) {
        sessionArray.delete(activeSessionId);
    }
    sessionArray.set(session.getSessionID(), session);
}

function removeSession(sessionId) {
    sessionArray.delete(sessionId);
}

function getSessionBySessionId(sessionId) {
    return sessionArray.get(sessionId);
}

function getSessionByUserId(userId) {
    const sessions = [];
    for (const session of sessionArray.values()) {
        if (session.getUserID() === userId) {
            sessions.push(session);
        }
    }
    return sessions;
}

function isUserInSession(userId) {
    for (const session of sessionArray.values()) {
        if (session.getUserID() === userId) {
            return session.getSessionID();
        }
    }
    return null;
}

function getSessionBySessionIdAndUserId(sessionId, userId) {
    const session = sessionArray.get(sessionId);
    return session && session.getUserID() === userId ? session : null;
}


function displaySessionSumary() {
    console.log("Session Array Preview:");
    console.log(`Number of Sessions: ${sessionArray.size}`);
    sessionArray.forEach((session, key) => {
        console.log(`Session ID: ${key}, User ID: ${session.getUserID()}, Number of Questions: ${session.getQuestionNumber()}`);
    });
}


module.exports = {
    addSession,
    removeSession,
    getSessionBySessionId,
    getSessionBySessionIdAndUserId,
    getSessionByUserId,
    isUserInSession,
    displaySessionSumary,
};