const Joi = require("joi")
const db = require("../modules/db");
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require("path")

function getQCMsAdminPage(req, res, next) {
    const getQCMsQuery = 'SELECT * FROM qcm ORDER BY year DESC, number ASC ';
    db.query(getQCMsQuery, (err, qcms) => {
        if (err) {
            console.error('Erreur lors de la récupération des qcm', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        const getYearsQuery = 'SELECT DISTINCT year FROM qcm ORDER BY year DESC';
        db.query(getYearsQuery, (err, years) => {
            if (err) {
                console.error('Erreur lors de la récupération des années', err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            // Continue with the rest of the code
            res.render("manage_qcm", { qcms, years });
        });
    });
}

function getSessionsDashboardPage(req, res, next) {
    const queryLastTrainingSession = 'SELECT * FROM training_sessions WHERE id_user = ? ORDER BY date DESC LIMIT 1';
    db.query(queryLastTrainingSession, [req.session.userId], (err, lastTrainingSession) => {
        if (err) {
            console.error('Erreur lors de la récupération des sessions de formation', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        const queryLastRevisionSession = `
        SELECT revision_sessions.year, qcm.* , revision_session_answers.id_revision_answer, revision_session_answers.answer, revision_session_answers.score, revision_session_answers.errors
        FROM revision_sessions
        RIGHT JOIN qcm ON revision_sessions.year = qcm.year
        LEFT JOIN revision_session_answers ON revision_session_answers.id_qcm = qcm.id_qcm AND revision_sessions.id_revision = revision_session_answers.id_revision
        WHERE id_user = ? AND active = 1
        ORDER BY revision_session_answers.id_revision_answer DESC
        LIMIT 1
        `;
        db.query(queryLastRevisionSession, [req.session.userId], (err, lastRevisionSession) => {
            if (err) {
                console.error('Erreur lors de la récupération des sessions d\'de révision', err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            const queryQuestionNumberForLastRevisionSession = 'SELECT count(*) as total FROM qcm WHERE year = ?';
            db.query(queryQuestionNumberForLastRevisionSession, [lastRevisionSession[0]?.year], (err, totalQuestions) => {
                if (err) {
                    console.error('Erreur lors de la récupération du nombre de questions', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }

                //lastRevisionSession[0].totalQuestions = totalQuestions[0].total;

                if(lastRevisionSession[0]?.number == totalQuestions[0].total){
                    lastRevisionSession[0] = null;
                }

                res.render("sessions_dashboard", { lastTrainingSession: lastTrainingSession[0], lastRevisionSession: lastRevisionSession[0] });
            });
        });
    });
}


function getAddQCMsPage(req, res, next) {
    res.render("add_qcm")
}

/*function getLoginPage(req, res, next) {
    res.render("login")
}

function logout(req, res, next) {
    req.session.destroy();
	return res.redirect('/login');
}*/

function addCategories(req, res, next) {
    res.sendStatus(400)
    return
    const questionSchema = Joi.object({
        annee: Joi.number().integer().greater(1980).required().label("L\'année"),
        categorie: Joi.array().items(Joi.string().trim()).required().label("Categorie"),
        type: Joi.string().valid("QCM", "QCS").required().label("Type de question"),
        numero: Joi.number().prefs({ convert: true }).integer().greater(0).required().label("Numéro de question"),
        question: Joi.string().trim().normalize().required().label("Question"),
        qcmA: Joi.string().trim().normalize().required().label("Réponse A"),
        qcmB: Joi.string().trim().normalize().required().label("Réponse B"),
        qcmC: Joi.string().trim().normalize().required().label("Réponse C"),
        qcmD: Joi.string().trim().normalize().required().label("Réponse D"),
        qcmE: Joi.string().trim().normalize().required().label("Réponse E"),
        correction: Joi.array().items(Joi.string().trim().length(1).uppercase()).required().label("Correction"),
        region: Joi.any().optional()
    })
    .messages({
        'any.required': 'Le champ {{#label}} est obligatoire',
        'string.min': 'Le champ {{#label}} doit contenir au moins {{#limit}} caractères',
        'string.max': 'Le champ {{#label}} ne doit pas dépasser {{#limit}} caractères',
        'string.empty': 'Le champ {{#label}} ne doit pas être vide',
        'any.only': 'Les mots de passe ne correspondent pas',
        'object.unknown': 'Vous avez renseigné un champ inconnu : {{#label}}',
        'number.greater': '{{#label}} est trop ancienne',
        'number.base': '{{#label}} doit être un entier',
        'array.base': 'Le champ {{#label}} doit être un tableau',
    });

    // Get existing categories
    const checkMailExistQuery = 'SELECT * FROM categories';
    db.query(checkMailExistQuery, (err, categories) => {
        if (err) {
            console.error('Erreur lors de la récupération des catégories', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        const files = req.files

        const insertedCat = []
        files.forEach(file => {
            fs.readFile(path.join(__dirname, "../", file.path), 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                const qcm = JSON.parse(data)

                let year = 0;

                if(qcm && qcm.length) {
                    qcm.forEach((question, index) => {
                        question.categorie = (question.categorie)?.split("-")
                        question.correction = (question.correction)?.split("")

                        const {error, value: safe_question} = questionSchema.validate(question)

                        if(error) {
                            console.error(error)
                            return
                        }

                        year = safe_question.annee

                        safe_question.categorie.forEach(cat => {
                            if(!insertedCat.includes(cat) && (categories.filter(obj => obj.name == cat)) == 0) {
                                insertedCat.push(cat)
                                const insertCatQuery = 'INSERT INTO categories (name) VALUES (?)';
                                db.query(insertCatQuery, [cat], (err, insertedCategory) => {
                                    if (err) {
                                        console.error('Erreur lors de l\'insertion de l\'utilisateur.trice :', err);
                                    }
                                })
                            }
                        })
                        
                    });
                }
            })
        });
    });

    res.sendStatus(200)
}


function add(req, res, next) {
    res.sendStatus(400)
    return
    const questionSchema = Joi.object({
        annee: Joi.number().integer().greater(1980).required().label("L\'année"),
        categorie: Joi.array().items(Joi.string().trim().min(0).optional()).required().label("Categorie"),
        type: Joi.string().valid("QCM", "QCS").required().label("Type de question"),
        numero: Joi.number().prefs({ convert: true }).integer().greater(0).required().label("Numéro de question"),
        question: Joi.string().trim().normalize().required().label("Question"),
        qcmA: Joi.string().trim().normalize().required().label("Réponse A"),
        qcmB: Joi.string().trim().normalize().required().label("Réponse B"),
        qcmC: Joi.string().trim().normalize().required().label("Réponse C"),
        qcmD: Joi.string().trim().normalize().required().label("Réponse D"),
        qcmE: Joi.string().trim().normalize().required().label("Réponse E"),
        correction: Joi.array().items(Joi.string().trim().length(1).uppercase()).required().label("Correction"),
        region: Joi.any().optional()
    })
    .messages({
        'any.required': 'Le champ {{#label}} est obligatoire',
        'string.min': 'Le champ {{#label}} doit contenir au moins {{#limit}} caractères',
        'string.max': 'Le champ {{#label}} ne doit pas dépasser {{#limit}} caractères',
        'string.empty': 'Le champ {{#label}} ne doit pas être vide',
        'any.only': 'Les mots de passe ne correspondent pas',
        'object.unknown': 'Vous avez renseigné un champ inconnu : {{#label}}',
        'number.greater': '{{#label}} est trop ancienne',
        'number.base': '{{#label}} doit être un entier',
        'array.base': 'Le champ {{#label}} doit être un tableau',
    });

    // Get existing categories
    const checkMailExistQuery = 'SELECT * FROM categories';
    db.query(checkMailExistQuery, (err, categories) => {
        if (err) {
            console.error('Erreur lors de la récupération des catégories', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        const files = req.files

        const insertedIds = []
        files.forEach(file => {
            fs.readFile(path.join(__dirname, "../", file.path), 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                const qcm = JSON.parse(data)
                const initial_length = qcm.length

                let year = 0;

                if(qcm && qcm.length) {
                    qcm.forEach((question, index) => {
                        question.categorie = (question.categorie)?.split("-")
                        question.correction = (question.correction)?.split("")

                        const {error, value: safe_question} = questionSchema.validate(question)

                        if(error) {
                            console.error(error)
                            return
                        }

                        year = safe_question.annee

                        const categoriesIds = []
                        safe_question.categorie.forEach(async cat => {
                            const categorieFound = (categories.filter(obj => obj.name == cat))
                            if(categorieFound.length > 0) {
                                categoriesIds.push(categorieFound[0].id_category)
                            }
                        })

                        // Insert qcm in database
                        const insertUserQuery = 'INSERT INTO qcm (year, type, number, question, A, B, C, D, E, correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                        db.query(insertUserQuery, [safe_question.annee, safe_question.type, safe_question.numero, safe_question.question, safe_question.qcmA, safe_question.qcmB, safe_question.qcmC, safe_question.qcmD, safe_question.qcmE, safe_question.correction.join(",")], (err, insertedQCM) => {
                            if (err) {
                                console.error('Erreur lors de l\'insertion de l\'utilisateur.trice :', err);
                                //return res.status(500).json({ message: 'Erreur serveur' });
                            }

                            categoriesIds.forEach(categoryId => {
                                // Insert relations between qcm and categories
                                const insertUserQuery = 'INSERT INTO qcms_categories (qcm, category) VALUES (?, ?)';
                                db.query(insertUserQuery, [insertedQCM.insertId, categoryId], (err, insertedQCMCategory) => {
                                    if (err) {
                                        console.error('Erreur lors de l\'insertion de l\'utilisateur.trice :', err);
                                        //return res.status(500).json({ message: 'Erreur serveur' });
                                    }
                                })
                            })
                        })
                    });

                    fs.writeFile('./server_files/data/'+year+'.json', JSON.stringify(qcm), function (err) {
                        if (err) throw err;
                        console.log('Saved!');
                    });
                    
                    const final_length = 0
                }
                //console.log(qcm);
            })
        });
    });

    res.sendStatus(200)
}

module.exports = {
    getQCMsAdminPage,
    getAddQCMsPage,
    getSessionsDashboardPage,
    add,
    addCategories
}