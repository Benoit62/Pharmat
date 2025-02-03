const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const db = require('../modules/db');

function sendReminderSMS() {
    console.log('Sending reminder SMS');
    /*client.messages
        .create({
            body: 'Sending reminder SMS !',
            from: '+12517148997',
            to: '+33783736316'
        })
        .then(message => console.log(message.sid))*/

    const queryUser = `SELECT users.*, training_sessions.* FROM users INNER JOIN training_sessions ON training_sessions.id_session = (SELECT id_session FROM training_sessions WHERE training_sessions.id_user = users.id_user ORDER BY training_sessions.id_session DESC LIMIT 1)`;
    db.query(queryUser, (err, result) => {
        if (err) {
            console.log(err);
        }
        else {
            result.forEach(user => {
                if(user.phone === '') return console.log('No phone number for user : ', user.name);
                const phone = '+33' + user.phone.slice(1);
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);

                if (user.last_login < twoDaysAgo) {
                    // User last login is more than 2 days ago
                    console.log('Sending reminder SMS to : ', user.name, ' at ', phone);
                    client.messages
                        .create({
                            body: 'Ca fait longtemps qu\'on ne t\'a pas vu, reviens vite !',
                            from: '+12517148997',
                            to: phone
                        })
                        .then(message => console.log(message.sid))
                }
                else if(user.last_session <= oneDayAgo && new Date().getHours() > 20){
                    // User last session is more than 1 day ago
                    console.log('Sending reminder SMS to : ', user.name, ' at ', phone);
                    client.messages
                        .create({
                            body: 'Tu n\'as pas fait de sessions aujourd\'hui, viens t\'entrainer pour être la meilleure !',
                            from: '+12517148997',
                            to: phone
                        })
                        .then(message => console.log(message.sid))
                }
            });
        }
    });
}

function greetingSMS() {
    console.log('Sending greeting SMS');
    /*client.messages
        .create({
            body: 'Sending greeting SMS !',
            from: '+12517148997',
            to: '+33783736316'
        })
        .then(message => console.log(message.sid))*/

    const queryPerf = `SELECT users.phone, users.name, AVG((score / (size * 2))*100) as perf FROM users INNER JOIN training_sessions ON training_sessions.id_user = users.id_user AND training_sessions.date = CURDATE() GROUP BY users.id_user`;
    db.query(queryPerf, (err, result) => {
        if (err) {
            console.log(err);
        }
        else {
            result.forEach(user => {
                if(user.phone === "") return console.log('No phone number for user : ', user.name);
                const phone = '+33' + user.phone.slice(1);
                const perf = parseInt(user.perf);
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
                console.log("Sending greeting SMS to : ", user.name, " with message : ", message, " at ", phone);
                client.messages
                        .create({
                            body: message,
                            from: '+12517148997',
                            to: phone
                        })
                        .then(message => console.log(message.sid))
            });
        }
    });
}

module.exports = {
    sendReminderSMS,
    greetingSMS
};



// Test SMS
/*client.messages
    .create({
        body: 'Revient vite',
        from: '+12517148997',
        to: '+33783736316'
    })
    .then(message => console.log(message.sid))
*/