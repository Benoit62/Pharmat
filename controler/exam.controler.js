const db = require("../modules/db");

function getExamDashboardPage(req, res, next) {
    res.render('exam_dashboard');
}


module.exports = {
    getExamDashboardPage
}