const db = require("../modules/db");
const JOI = require("joi");

function getNotifPage(req, res, next) {

    const queryGetUser = "SELECT * FROM users WHERE id_user = ?"
    db.query(queryGetUser, [req.session.userId], (err, userResult) => {
        if(err) {
            console.error(err)
            return res.render("/error")
        }

        const user = userResult[0]

        return res.render("notif", { user: user })
    })

}

function addPhoneNumber(req, res, next) {
    const phoneNumber = req.body.phoneNumber;

    const schema = JOI.object({
        phoneNumber: JOI.string().required().regex(/^[0-9]{10}$/)
    }).messages({
        "string.empty": "Le numéro de téléphone ne peut pas être vide",
        "string.pattern.base": "Le numéro de téléphone doit être composé de 10 chiffres",
        "any.required": "Le numéro de téléphone est requis"
    })

    const { error, value:data } = schema.validate({ phoneNumber })

    if(error) {
        return res.status(400).json({ message: error.details[0].message.replaceAll('"', '') })
    }

    const queryUpdatePhone = "UPDATE users SET phone = ? WHERE id_user = ?"
    db.query(queryUpdatePhone, [data.phoneNumber, req.session.userId], (err, result) => {
        if(err) {
            console.error('Erreur lors de l\ajout du numéro de téléphone', err)
            return res.status(500).json({ message: "Erreur serveur" })
        }

        return res.status(200).json({ message: "Numéro de téléphone ajouté avec succès" })
    })
}

module.exports = {
    getNotifPage,
    addPhoneNumber
}