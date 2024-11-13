const express = require('express');
const router = express.Router();
const controler = require("../controler/session_dashboard.controler");
const { v4: uuidv4 } = require('uuid');
const adminMiddleware = require("../modules/adminMiddleware");
const authMiddleware = require("../modules/authMiddleware");

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
	    cb(null, './server_files/tmp/')
	},
	filename: (req, file, cb) => {
        const extname = path.extname(file.originalname);
        cb(null, uuidv4() + extname);
    },
})
// Filtrer pour n'accepter que les fichiers image (extension .jpg, .jpeg, .png, etc.)
const seqaFilter = (req, file, cb) => {
    if (file.originalname.endsWith('.seqa')) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers avec l\'extension .seqa sont autorisés.'));
    }
};
const upload = multer({ //multer settings
    storage: storage,
    fileFilter: seqaFilter,
})

// Route pour obtenir la liste des articles
router.post('/qcm/import', adminMiddleware, upload.array("import"), controler.add);

router.post('/categories/import', adminMiddleware, upload.array("import"), controler.addCategories);

router.get('/qcm/manage', adminMiddleware, controler.getQCMsAdminPage);

router.get('/qcm/add', adminMiddleware, controler.getAddQCMsPage);


// Route pour obtenir la page des QCMS
router.get('/dashboard', authMiddleware, controler.getSessionsDashboardPage);

module.exports = router;