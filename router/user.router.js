const express = require('express');
const router = express.Router();
const adminMiddleware = require("../modules/adminMiddleware");
const controler = require("../controler/user.controler");

router.get('/users/manage', adminMiddleware, controler.getUsers);

router.get('/users/:user', adminMiddleware, controler.getUser);

module.exports = router;