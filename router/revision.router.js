const express = require('express');
const router = express.Router();
const controler = require("../controler/revision.controler");
const { v4: uuidv4 } = require('uuid');
const adminMiddleware = require("../modules/adminMiddleware");
const authMiddleware = require("../modules/authMiddleware");


router.get('/revision', authMiddleware, controler.getRevisionDashboard);

router.post('/revision/start', authMiddleware, controler.startRevisionSession);

router.get('/revision/:id', authMiddleware, controler.joinRevisionSession);

router.post('/revision/reset', authMiddleware, controler.resetRevisionSession);

router.get('/revision/compare/:year', authMiddleware, (req, res, next) => {
    res.redirect('/revision');
});

module.exports = router;