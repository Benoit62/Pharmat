const express = require('express');
const router = express.Router();
const controler = require("../controler/exam.controler");
const adminMiddleware = require("../modules/adminMiddleware");
const authMiddleware = require("../modules/authMiddleware");

router.get('/exam', authMiddleware, controler.getExamDashboardPage);

module.exports = router;