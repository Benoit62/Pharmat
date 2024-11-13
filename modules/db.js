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

module.exports = db;