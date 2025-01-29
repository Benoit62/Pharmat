const Joi = require("joi")
const db = require("../modules/db");
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

function getRegisterPage(req, res, next) {
    res.render("register")
}

function getLoginPage(req, res, next) {
    res.render("login")
}

function logout(req, res, next) {
    req.session.destroy();
	return res.redirect('/login');
}

function register(req, res, next) {
    const data = req.body

    const regSchema = Joi.object({
        mail: Joi.string().trim().email().required().max(100).label("Mail"),
        name: Joi.string().regex(/^[\w -]+$/).min(2).max(30).required().label("Nom"),
        password: Joi.string().min(2).max(30).required().label("Mot de passe"),
        confirm_password: Joi.ref("password")
    })
    .messages({
        'any.required': 'Le champ {{#label}} est obligatoire',
        'string.min': 'Le champ {{#label}} doit contenir au moins {{#limit}} caractères',
        'string.max': 'Le champ {{#label}} ne doit pas dépasser {{#limit}} caractères',
        'string.empty': 'Le champ {{#label}} ne doit pas dépasser être vide',
        'any.only': 'Les mots de passe ne correspondent pas',
        'object.unknown': 'Vous avez renseigné un champ inconnu : {{#label}}',
    });

    const {error, value: safe_data} = regSchema.validate(data)

    console.log(error)
      
    if(error){
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') });
    }

    // Verify if mail already used
    const checkMailExistQuery = 'SELECT COUNT(*) AS total FROM users WHERE mail = ?';
    db.query(checkMailExistQuery, [safe_data.mail], (err, checkResult) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'utilisateur.trice :', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (checkResult[0].total > 0) {
            return res.status(409).json({ message: 'Cet.te utilisateur.trice existe déjà' });
        }
        else {
            //Hash password
            bcrypt.hash(safe_data.password, 10, (err, hash) => {
                if (err) {
                    console.error('Erreur lors du hachage du mot de passe :', err);
                    return res.status(500).json({ message: 'Erreur serveur' });
                }
                else {
                    const confirm_id = uuidv4()
                    // Insert user in database
                    const insertUserQuery = 'INSERT INTO users (name, password, mail, confirm_id, status, last_login) VALUES (?, ?, ?, ?, ?, ?)';
                    db.query(insertUserQuery, [safe_data.name, hash, safe_data.mail, confirm_id, "USER", new Date().toISOString().split('T')[0]], (err, insertResult) => {
                        if (err) {
                            console.error('Erreur lors de l\'insertion de l\'utilisateur.trice :', err);
                            return res.status(500).json({ message: 'Erreur serveur' });
                        }

                        //Building mail data
                        const transporter = nodemailer.createTransport({
                            host: "smtp-pharmat.alwaysdata.net",
                            port: 587,
                            secure: false, // Use `true` for port 465, `false` for all other ports
                            auth: {
                              user: process.env.MAIL_USER,
                              pass: process.env.MAIL_PWD,
                            },
                        });

                        var mailOptions = {
                            from: process.env.MAIL_USER,
                            to: safe_data.mail,
                            subject: 'Confirmation de votre adresse mail',
                            html: `
                            <h2 style="text-align: center">Bienvenue sur Pharmat !</h2>
                            <a style="display: block; width: fit-content; padding: 1% 3%; border-radius: 10px; color: white; font-weight: bolder; margin: 10px auto; font-size: 160%; border: none; cursor: pointer; background-color: #3e69b2; text-decoration: none" href="http://${req.get("host")}/confirmation/${confirm_id.replace(/'/g, '&#39;')}">Confirmer</a>
                            `, // html body
                        };

                        //Sending mail
                        transporter.sendMail(mailOptions, function(error, info){
                            if (error) {
                                console.log(error);
                                return res.status(500).json({ message: 'Erreur lors de l\'envoie du mail, vérifiez votre adresse mail et réessayez' });
                            } else {
                                console.log('Email sent: ' + info.response);
                                return res.status(200).json({ message: 'Enregistré avec succès, confirmez votre adresse mail avant de pouvoir vous connecter'});
                            }
                        });
                    });
                }
            });
        }
    });

    
    /*result = model.register(safe_data)
    console.log(result)
    return res.status(result.status).json({ message: result.message });*/
}

function login(req, res, next) {
    const data = req.body

    const logSchema = Joi.object({
        mail: Joi.string().trim().email().required().max(100).label("Mail"),
        password: Joi.string().min(2).max(30).required().label("Mot de passe")
    })
    .messages({
        'any.required': 'Le champ {{#label}} est obligatoire',
        'string.min': 'Le champ {{#label}} doit contenir au moins {{#limit}} caractères',
        'string.max': 'Le champ {{#label}} ne doit pas dépasser {{#limit}} caractères',
        'string.empty': 'Le champ {{#label}} ne doit pas dépasser être vide',
        'object.unknown': 'Vous avez renseigné un champ inconnu : {{#label}}',
    });

    const {error, value: safe_data} = logSchema.validate(data)

    console.log(error)
      
    if(error){
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') });
    }

    // Verify if account exist
    const checkAccountExistQuery = 'SELECT * FROM users WHERE mail = ?';
    db.query(checkAccountExistQuery, [safe_data.mail], (err, users) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'utilisateur.trice :', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }

        if (users.length <= 0) {
            return res.status(409).json({ message: 'Cet.te utilisateur.trice n\'existe pas' });
        }

        const user = users[0]
        //Hash password
        bcrypt.compare(safe_data.password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Erreur lors du hachage du mot de passe :', err);
                return res.status(500).json({ message: 'Erreur serveur' });
            }

            if (!isMatch) {
                return res.status(401).json({ message: 'Mot de passe incorrect' });
            }
            
            req.session.status = users[0].status;
            req.session.isAuthenticated = true;
            // Vous pouvez également stocker d'autres informations de session si nécessaire
            req.session.userId = user.id_user;
            req.session.userName = user.name;

            const query = 'UPDATE users SET last_login = NOW() WHERE id_user = ?';
            db.query(query, [user.id_user], (err, result) => {
                if (err) {
                    console.error('Erreur lors de la mise à jour de la date de connexion :', err);
                }
            });
    
            return res.status(200).json({ message: 'Connecté' });
        });
    });
}


function confirm(req, res, next) {
    const data = req.params

    const confirmSchema = Joi.object({
        confirm_id: Joi.string().guid({version: ['uuidv4']}).required().label("Identifiant de confirmation"),
    })
    .messages({
        'any.required': 'Le champ {{#label}} est obligatoire',
        'string.empty': 'Le champ {{#label}} ne doit pas dépasser être vide',
        'string.guid': 'Le champ {{#label}} ne correspond pas à un format valide',
        'object.unknown': 'Vous avez renseigné un champ inconnu : {{#label}}',
    });

    const {error, value: safe_data} = confirmSchema.validate(data)

    console.log(error)
      
    if(error){
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') });
    }

    //return res.render("vue/login")

    // Verify if id correspond to an user
    const checkConfirmIdExistQuery = 'SELECT * FROM users WHERE confirm_id = ?';
    db.query(checkConfirmIdExistQuery, [safe_data.confirm_id], (err, users) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'identifiant de confirmation :', err);
            return res.render("confirm",  {message: "Erreur serveur"});
        }

        if (users.length <= 0) {
            return res.render("confirm",  {message: "Nous n'avons pas trouvé votre compte, essayez de vous connecter si vous l'avez déjà confirmé"});
        }
        else {
            // Delete confirm_id
            const deleteConfirmIdQuery = 'UPDATE users SET confirm_id = ""';
            db.query(deleteConfirmIdQuery, (err, resultUpdate) => {
                if (err) {
                    console.error('Erreur lors de la suppression de l\'identifiant de connexion :', err);
                    return res.render("confirm",  {message: "Erreur serveur"});
                }
                
                return res.render("confirm",  {message: `Adresse confirmée avec succès<br>Bienvenue ${users[0].name}`});
            });
        }
    });

    
    /*result = model.register(safe_data)
    console.log(result)
    return res.status(result.status).json({ message: result.message });*/
}

module.exports = {
    getRegisterPage,
    getLoginPage,
    logout,
    register,
    login,
    confirm
}