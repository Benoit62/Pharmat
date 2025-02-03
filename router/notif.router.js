const express = require('express');
const router = express.Router();
const controler = require("../controler/notif.controler");
const authMiddleware = require("../modules/authMiddleware");

// Route pour obtenir la liste des articles
router.get('/notif', authMiddleware, controler.getNotifPage);

router.post('/notif/phoneNumber', authMiddleware, controler.addPhoneNumber);

module.exports = router;