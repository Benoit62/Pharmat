class QuestionObject {
    constructor(id_qcm, year, type = "QCM", number, question, answers = new Map(), correct = null) {
        this.id_qcm = id_qcm;
        this.year = year;
        this.type = type;
        this.number = number;
        this.question = question;
        this.answers = answers;
        this.correct = correct;
        this.userAnswers = [];
        this.score = 0;
    }
}

QuestionObject.prototype.getAnswer = function(letter) {
    return this.answers.get(letter);
}

QuestionObject.prototype.getCorrect = function() {
    return this.correct;
}

QuestionObject.prototype.getId = function() {
    return this.id_qcm;
}

QuestionObject.prototype.getYear = function() {
    return this.year;
}

QuestionObject.prototype.getType = function() {
    return this.type;
}

QuestionObject.prototype.getNumber = function() {
    return this.number;
}

QuestionObject.prototype.getQuestion = function() {
    return this.question;
}

QuestionObject.prototype.getAnswers = function() {
    return this.answers;
}

QuestionObject.prototype.getCorrect = function() {
    return this.correct;
}

QuestionObject.prototype.addUserAnswer = function(answer) {
    this.userAnswers = answer;
    console.log("User answer added", this.userAnswers);
    console.log("Correct answers", this.correct);
}

QuestionObject.prototype.getUserAnswer = function() {
    return this.userAnswers;
}

QuestionObject.prototype.reduceToArray = function() {
    return {
        id_qcm: this.id_qcm,
        year: this.year,
        type: this.type,
        number: this.number,
        question: this.question,
        answers: Array.from(this.answers),
        correct: this.correct,
        userAnswers: this.userAnswers
    };
}

QuestionObject.prototype.calculateScore = function() {
    let error = this.getErrorNumber();
    
    if(this.type === "QCS") {
        if(this.userAnswers[0] === this.correct[0]) {
            this.score = 2;
        }
        else {
            this.score = 0;
        }
    }
    else {
        switch (error) {
            case 0:
                this.score = 2;
                break;
            case 1:
                this.score = 1;
                break;
            case 2:
                this.score = 0.4;
                break;
            default:
                this.score = 0;
        }
    }
};

QuestionObject.prototype.getScore = function() {
    return this.score;
};

QuestionObject.prototype.getErrorNumber = function() {
    let error = 0;
    if(this.type === "QCS") {
        if(this.userAnswers[0] === this.correct[0]) {
            error = 0;
        }
        else {
            error = 1;
        }
    }
    else {
        for (let answer of this.userAnswers) {
            if (!this.correct.includes(answer)) {
                error++;
            }
        }
        for (let correct of this.correct) {
            if (!this.userAnswers.includes(correct)) {
                error++;
            }
        }
    }
    return error;
};



module.exports = QuestionObject