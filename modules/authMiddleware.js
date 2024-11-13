//vérifie que l'user est bien authentifié
const authMiddleware = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        return res.redirect('/login?origin='+req.url);
    }
};

module.exports = authMiddleware;