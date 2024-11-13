//vérifie que l'user est bien authentifié en tant qu'admin
const adminMiddleware = (req, res, next) => {
    console.log("adminMiddleware")
    console.log(req.session)
    if (req.session.isAuthenticated) {
        if(req.session.status == "ADMIN") {
            next();
        }
        else {
            return res.redirect('/home');
        }
    }
    else {
        return res.redirect('/login?origin='+req.url);
    }
};

module.exports = adminMiddleware;