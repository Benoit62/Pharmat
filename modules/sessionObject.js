class SessionObject {
    constructor(userID, sessionID, questions = [], year, type) {
        this.userID = userID;
        this.sessionID = sessionID;
        this.questions = questions;
        this.activeIndex = 0;
        this.status = "active";
        this.score = 0;
        this.maxScore = questions.length * 2;
        this.year = year;
        this.type = type;
    }
}

SessionObject.prototype.addQuestion = function(question) {
    this.questions.push(question);
}

SessionObject.prototype.getQuestion = function(index) {
    return this.questions[index];
}

SessionObject.prototype.getYear = function() { return this.year; }

SessionObject.prototype.getUserID = function() {
    return this.userID;
}

SessionObject.prototype.getSessionID = function() {
    return this.sessionID;
}

SessionObject.prototype.getQuestionNumber = function() {
    return this.questions.length;
}

SessionObject.prototype.getIndexOfQuestionsWithAnswer = function() {
    const indexes = [];
    this.questions.forEach((question, index) => {
        if (question.getUserAnswer().length > 0) {
            indexes.push(index);
        }
    });
    return indexes;
}

SessionObject.prototype.getNumberOfQuestionsAnswered = function() {
    let count = 0;
    this.questions.forEach((question) => {
        if (question.getUserAnswer().length > 0) {
            count++;
        }
    });
    return count;
}

SessionObject.prototype.getActiveIndex = function() {    
    return this.activeIndex;
}

SessionObject.prototype.setActiveIndex = function(index) {
    this.activeIndex = parseInt(index);
}

SessionObject.prototype.getActiveQuestion = function() {    
    return this.questions[this.activeIndex];
}

/*SessionObject.prototype.nextQuestion = function() {   
    const index = this.questions.indexOf(this.activeQuestion);
    if (index < this.questions.length - 1) {
        this.activeQuestion = this.questions[index + 1];
    }
}*/

SessionObject.prototype.addUserAnswer = function(answer, questionIndex) {
    if(this.status === "ended") {
        return "Session has ended";
    }
    console.log("Answer received on sessionObject", answer, questionIndex);
    const question = this.getQuestion(questionIndex);
    console.log("Question found", question);
    question.addUserAnswer(answer);

    if (this.activeIndex < this.questions.length - 1) {
        this.activeIndex++;
    }
}

SessionObject.prototype.checkfinishedSession = function() {
    return this.getNumberOfQuestionsAnswered() === this.questions.length;
}

SessionObject.prototype.endSession = function() {
    this.status = "ended";
    this.questions.forEach((question) => {
        question.calculateScore();
        this.score += question.getScore();
    });
}

SessionObject.prototype.getStatus = function() {
    return this.status;
}

SessionObject.prototype.getQuestionScore = function() {
    return this.questions[this.activeIndex].getScore();
}

SessionObject.prototype.getAllQuestionsScore = function() {
    const scores = [];
    this.questions.forEach((question) => {
        scores.push(question.getScore());
    });
    return scores;
}

SessionObject.prototype.getSessionScore = function() { return this.score; }

SessionObject.prototype.getMaxScore = function() { return this.maxScore; }

SessionObject.prototype.getErrorNumber = function() {
    return this.questions[this.activeIndex].getErrorNumber();
}

SessionObject.prototype.getAnswers = function() {
    const answers = [];
    this.questions.forEach((question) => {
        answers.push({id_qcm: question.getId(), answers:question.getUserAnswer(), score: question.getScore(), errors_number: question.getErrorNumber()});
    });
    return answers;
}

SessionObject.prototype.getSessionType = function() {
    return this.type;
}

module.exports = SessionObject