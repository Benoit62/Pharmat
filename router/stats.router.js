const express = require('express');
const statsController = require('../controler/stats.controler');

const router = express.Router();

// GET request for the stats page
router.get('/stats', statsController.getStats);

module.exports = router;