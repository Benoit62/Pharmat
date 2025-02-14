const express = require('express');
const router = express.Router();
const controler = require("../controler/home.controler");
const authMiddleware = require("../modules/authMiddleware");

// Route pour obtenir la liste des articles
router.get('/home', authMiddleware, controler.getHomePage);

module.exports = router;