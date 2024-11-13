const express = require('express');
const router = express.Router();

router.get('/error', (req, res) => {
    res.render("404.ejs");
});

router.get('*', (req, res) => {
    res.render("404.ejs");
});

router.get('/*', (req, res) => {
    res.render("404.ejs");
});


module.exports = router;