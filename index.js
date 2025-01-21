const express = require('express');
const session = require('express-session');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
//const helmet = require('helmet')
const dotenv = require("dotenv")
const MySQLStore = require('express-mysql-session')(session);
const socketIo = require('socket.io');
var cron = require('node-cron');

dotenv.config()

const options = {
	host: process.env.SESSION_DB_HOST,
	user: process.env.SESSION_DB_USER,
	password: process.env.SESSION_DB_PWD,
	database: process.env.SESSION_DB_DATABASE
};

const sessionStore = new MySQLStore(options);

/*// Initialize client.
let redisClient = createClient()
redisClient.connect().catch(console.error)
// Initialize store.
let redisStore = new RedisStore({
  client: redisClient,
  prefix: "myapp:",
})*/

const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: false,
        sameSite: true
    }
});


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/assets/", express.static(path.join(__dirname + '/assets/')));
app.use(sessionMiddleware);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//app.use(helmet())

app.set('view engine', 'ejs');

const index = require('./router/index.router');
app.use(index);
const auth = require('./router/auth.router');
app.use(auth);
const home = require('./router/home.router');
app.use(home);
const admin = require('./router/admin.router');
app.use(admin);
const qcm = require('./router/session_dashboard.router');
app.use(qcm);
const trainingRouter = require('./router/training.router');
app.use(trainingRouter);
const revisionRouter = require('./router/revision.router');
app.use(revisionRouter);
const examRouter = require('./router/exam.router');
app.use(examRouter);
const history = require('./router/history.router');
app.use(history);
const stats = require('./router/stats.router');
app.use(stats);
const user = require('./router/user.router');
app.use(user);

const error = require('./router/404.router');
app.use(error);

const server = http.Server(app);

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sessionMiddleware.cookie.secure = true // serve secure cookies
}

const sharedSession = require('express-socket.io-session');
const io = socketIo(server);
// Configuration de Socket.io pour utiliser la session
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

const sessionHandler = require("./socket/sessionHandler");

const onConnection = (socket) => {
    console.log("New connection");
    sessionHandler(io, socket);
}

io.on("connection", onConnection);

const smsCronTasks = require('./cron/sms');
const mailCronTasks = require('./cron/mail');
cron.schedule('30 20 * * *', () => {
    //smsCronTasks.sendReminderSMS();
    mailCronTasks.sendReminderMail();
}, {
    scheduled: true,
    timezone: "Europe/Paris"
});

cron.schedule('0 22 * * *', () => {
    //smsCronTasks.greetingSMS();
    mailCronTasks.greetingMail();
}, {
    scheduled: true,
    timezone: "Europe/Paris"
});

const port = process.env.PORT;
//start server at localhost:4200
server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});