const express = require('express');
const router = express.Router();
const adminMiddleware = require("../modules/adminMiddleware");

router.get('/manage_qcm', adminMiddleware, (req, res) => {
    res.render("manage_qcm.ejs");
});

router.get('/manage_norms', adminMiddleware, (req, res) => {
    res.render("manage_norms.ejs");
});

router.get('/manage_stats', adminMiddleware, (req, res) => {
    res.render("manage_stats.ejs");
});

module.exports = router;