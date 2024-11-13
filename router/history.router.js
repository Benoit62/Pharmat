const express = require('express');
const historyController = require('../controler/history.controler');
const authMiddleware = require('../modules/authMiddleware');

const router = express.Router();

// Route for getting the history page
router.get('/history', authMiddleware, historyController.getHistoryPage);

router.get('/training/history/:session', authMiddleware, historyController.getTrainingSessionHistoryPage);

router.get('/revision/history/:year', authMiddleware, historyController.getRevisionHistoryPage);

//router.get('/exam/history/:exam', authMiddleware, historyController.getExamHistory);


/*// Route for retrieving session history
router.get('/session', historyController.getSessionHistory);

// Route for retrieving exam history
router.get('/exam', historyController.getExamHistory);

// Route for adding a new session to history
router.post('/session', historyController.addSessionToHistory);

// Route for adding a new exam to history
router.post('/exam', historyController.addExamToHistory);

// Route for deleting a session from history
router.delete('/session/:id', historyController.deleteSessionFromHistory);

// Route for deleting an exam from history
router.delete('/exam/:id', historyController.deleteExamFromHistory);*/

module.exports = router;