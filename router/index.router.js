const express = require('express');
const router = express.Router();
const controler = require("../controler/index.controler");

/*let directory = __dirname.replace("\\back\\router", "")
directory = directory.replace("\/back\/router", "")*/

// Route pour obtenir la liste des articles
router.get('/', controler.start);

module.exports = router;