const mysql = require('mysql2');

// Configuration de la connexion à la BDD
const dbConfig = {
    host     : process.env.DB_HOST,
	user     : process.env.DB_USER,
	password : process.env.DB_PWD,
	database : process.env.DB_DATABASE
};

// Création de la connexion
const db = mysql.createConnection(dbConfig);

setInterval(() => {
    db.query('SELECT 1')
        .then(() => console.log('Keep-alive query executed'))
        .catch(err => console.error('Keep-alive query failed:', err));
}, 1000 * 60 * 60); // Exécuter toutes les 1 heures

module.exports = db;