const express = require('express');
const router = express.Router();
const controler = require("../controler/training.controler");
const { v4: uuidv4 } = require('uuid');
const adminMiddleware = require("../modules/adminMiddleware");
const authMiddleware = require("../modules/authMiddleware");

router.get('/training', authMiddleware, controler.getTrainingDashboard);

router.post('/training/start', authMiddleware, controler.startTrainingSession);

router.get('/training/:id', authMiddleware, controler.joinTrainingSession);

module.exports = router;