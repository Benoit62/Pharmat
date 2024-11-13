const nodemailer = require('nodemailer');

require('dotenv').config();
const hostname = process.env.HOSTNAME;

const db = require('../modules/db');

//Building mail data
const transporter = nodemailer.createTransport({
    host: "smtp-pharmat.alwaysdata.net",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PWD,
    },
});

const mail = "bebewatti@gmail.com"

function sendReminderMail() {
    console.log('Sending reminder Mail');
    /*client.messages
        .create({
            body: 'Sending reminder SMS !',
            from: '+12517148997',
            to: '+33783736316'
        })
        .then(message => console.log(message.sid))*/

    const queryUser = `SELECT users.*, sessions.* FROM users INNER JOIN sessions ON sessions.id_session = (SELECT id_session FROM sessions WHERE sessions.id_user = users.id_user ORDER BY sessions.id_session DESC LIMIT 1)`;
    db.query(queryUser, (err, result) => {
        if (err) {
            console.log("Error lors de la récupération des utilisateurs", err);
        }
        else {
            result.forEach(user => {
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);

                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                
                if(user.last_login <= sevenDaysAgo){
                    console.log('Sending mail to', user.mail, " who last logged in at more than 7 days ago");
                    
                    const lastLoginDate = user.last_login;
                    const currentDate = new Date();
                    const timeDifference = Math.abs(currentDate.getTime() - lastLoginDate.getTime());
                    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

                    var mailOptions = {
                        from: process.env.MAIL_USER,
                        to: user.mail,
                        subject: 'Tu t\'es cru en vacances ?',
                        html: `
                        <h2 style="text-align: center">Hello, tu te souviens de nous ${user.name} ?</h2>
                        <p>Ca fait ${daysDifference} jours qu'on ne t'a pas vu. Il serait temps de revenir t'entrainer !</p>
                        <a style="display: block; width: fit-content; padding: 1% 3%; border-radius: 10px; color: white; font-weight: bolder; margin: 10px auto; font-size: 160%; border: none; cursor: pointer; background-color: #3e69b2; text-decoration: none" href="${hostname}">C'est reparti !</a>
                        `,
                    };
                    console.log("Sending reminder Mail to : ", user.name, " at ", user.mail);
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });
                }
                else if (user.last_login < twoDaysAgo) {
                    console.log('Sending mail to', user.mail, " who last logged in at two days ago");
                    // User last login is more than 2 days ago
                    var mailOptions = {
                        from: process.env.MAIL_USER,
                        to: user.mail,
                        subject: 'Reviens vite !',
                        html: `
                        <h2 style="text-align: center">Où es-tu passé ${user.name} !</h2>
                        <p>Ca fait longtemps qu\'on ne t\'a pas vu, reviens vite !</p>
                        <a style="display: block; width: fit-content; padding: 1% 3%; border-radius: 10px; color: white; font-weight: bolder; margin: 10px auto; font-size: 160%; border: none; cursor: pointer; background-color: #3e69b2; text-decoration: none" href="${hostname}">C'est parti !</a>
                        `,
                    };
                    console.log("Sending reminder Mail to : ", user.name, " at ", user.mail);
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });
                }
                else if(user.date <= oneDayAgo && new Date().getHours() >= 19){
                    console.log('Sending mail to', user.mail, " who last session was at one day ago");
                    var mailOptions = {
                        from: process.env.MAIL_USER,
                        to: user.mail,
                        subject: 'Reviens vite !',
                        html: `
                        <h2 style="text-align: center">On se la coule douce ${user.name} ?</h2>
                        <p>Tu n\'as pas fait de sessions aujourd\'hui, viens t\'entrainer pour être la meilleure !</p>
                        <a style="display: block; width: fit-content; padding: 1% 3%; border-radius: 10px; color: white; font-weight: bolder; margin: 10px auto; font-size: 160%; border: none; cursor: pointer; background-color: #3e69b2; text-decoration: none" href="${hostname}/qcms">Entrainement</a>
                        
                        `,
                    };
                    console.log("Sending reminder Mail to : ", user.name, " at ", user.mail);
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                        }
                    });
                }
            });
        }
    });
}

function greetingMail() {
    console.log('Sending greeting Mail');
    /*client.messages
        .create({
            body: 'Sending greeting SMS !',
            from: '+12517148997',
            to: '+33783736316'
        })
        .then(message => console.log(message.sid))*/

    const queryPerf = `SELECT users.mail, users.name, AVG((score / (size * 2))*100) as perf FROM users INNER JOIN sessions ON sessions.id_user = users.id_user AND sessions.date = CURDATE() GROUP BY users.id_user`;
    db.query(queryPerf, (err, result) => {
        if (err) {
            console.log(err);
        }
        else {
            result.forEach(user => {
                const perf = parseInt(user.perf);
                console.log('Sending mail to', user.mail, " with perf", perf, " / 100");
                let message = '';
                if(perf < 25){
                    message = `Ta moyenne du jour est de ${perf} / 100, il faut que tu t'entraines plus !`
                }
                else if(perf < 50){
                    message = `Ta moyenne du jour est de ${perf} / 100, tu peux faire mieux !`
                }
                else if(perf < 75){
                    message = `Ta moyenne du jour est de ${perf} / 100, continue comme ça !`
                }
                else {
                    message = `Ta moyenne du jour est de ${perf} / 100, tu es trop forte !`
                }
                console.log("Sending greeting Mail to : ", user.name, " with message : ", message, " at ", user.mail);
                var mailOptions = {
                    from: process.env.MAIL_USER,
                    to: user.mail,
                    subject: 'Bilan du jour',
                    html: `
                    <h2 style="text-align: center">Voici ton petit bilan du jour ${user.name} !</h2>
                    <p>${message}</p>
                    `,
                };

                transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            });
        }
    });
}

module.exports = {
    sendReminderMail,
    greetingMail
};

