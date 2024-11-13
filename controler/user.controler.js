const db = require("../modules/db");

const getUsers = (req, res) => {
    db.query("SELECT * FROM users", (err, result) => {
        if (err) {
            return res.redirect("/error");
        }
        res.render("manage_users", { users: result });
    });
}

const getUser = (req, res) => {
    const user = req.params.user;
    const queryUser = `SELECT * FROM users WHERE id_user = ?`
    db.query(queryUser, [user], (err, result) => {
        if (err) {
            return res.redirect("/error");
        }

        if (result.length === 0) {
            return res.redirect("/error");
        }

        const queryHistory = 'SELECT * FROM sessions WHERE id_user = ? ORDER BY id_session DESC';
        db.query(queryHistory, user, (err, history) => {
            if (err) {
                console.error('Erreur lors de la récupération de l\'historique', err);
                return res.redirect("/error");
            }
            
            res.render("manage_user", { user: result[0], history });
        });


    });
}

module.exports = {
    getUsers,
    getUser
}