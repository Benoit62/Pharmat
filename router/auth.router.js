const express = require('express');
const router = express.Router();
const controler = require("../controler/auth.controler");

// Route pour obtenir la liste des articles
router.get('/register', controler.getRegisterPage);

router.get('/login', controler.getLoginPage);

router.get('/logout', controler.logout);

router.post('/register', controler.register);

router.post('/login', controler.login);

router.get("/confirmation/:confirm_id", controler.confirm)

module.exports = router;