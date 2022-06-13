const express = require("express")
const session = require("express-session")
const bcrypt = require("bcrypt")
const mongoose = require("mongoose")
const passport = require("passport")
const LocalStrategy = require("passport-local").Strategy
const handlebars = require("express-handlebars")
const { fork } = require("child_process")
const dotenv = require("dotenv")
const minimist = require("minimist")
const cluster = require("cluster")
const os = require("os")
const compression = require("compression")
const log4js = require("log4js")
const ejs = require("ejs")
const User = require("./models/usersSchema.js")
const crypto = require("crypto")

log4js.configure({
    appenders: {
        theLoggerConsole: { type: "console" },
        theLoggerFile: { type: "file", filename: "logs/warns.log" },
        theLoggerFile2: { type: "file", filename: "logs/errors.log" }
    },
    categories: {
        default: { appenders: ["theLoggerConsole"], level: "info" },
        file: { appenders: ["theLoggerFile"], level: "warn" },
        file2: { appenders: ["theLoggerFile2"], level: "error" },
    }
})

let logConsole = log4js.getLogger()
let logWarn = log4js.getLogger("file")
let logError = log4js.getLogger("file2")


dotenv.config();


const options = {default:{mode:'fork'}, alias:{p:'port'}};
const args = minimist(process.argv.slice(2),options)

const __filename = url.fileURLToPath(
    import.meta.url);
const __dirname = url.fileURLToPath(new URL('.',
    import.meta.url));

const app = express();

const PORT = args.port || 8080;
const cpus = os.cpus().length;


switch (args.mode){
    case 'fork':
        const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}.`));
        break;
    case 'cluster':
        if(cluster.isPrimary){
            console.log(`Master process ${process.pid} is running.`);
            logConsole.info(`master ${process.pid} is running`);
            for(let i=0; i<cpus; i++){
                cluster.fork();
            }
            cluster.on('exit',(worker,code,signal) => {
                console.log(`Worker ${worker.process.pid} exited.`)
                logConsole.info(`worker ${worker.process.pid} exited`)
            })
        } else {
            const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}.`));
            console.log(`Worker process ${process.pid} is running.`)
            logConsole.info(`worker ${process.pid} started`)

        }
        break;
    default:
        break;
}   

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(__dirname + '/public'));

mongoose.connect(process.env.MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, err => {
    if (err) throw new Error("Couldn't connect to db ")
    console.log('db connected ')
})

app.use(session({
    store: MongoStore.create({
        mongoUrl: process.env.SESSION,
        ttl: 10000
    }),
    secret: process.env.SESSIONSECRET,
    resave: false,
    saveUninitialized: false

}))

const createHash = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10))
}

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    return done(null, user.id);
})

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        return done(err, user)
    })
})

passport.use('signup', new LocalStrategy({
    passReqToCallback: true
}, (req, username, password, done) => {
    User.findOne({
        username: username
    }, (err, user) => {
        if (err) return done(err);
        if (user) return done(null, false, {
            message: 'user already exists'
        });
        const newUser = {
            username: username,

            password: createHash(password)
        }
        User.create(newUser, (err, userCreated) => {
            if (err) return done(err);
            return done(null, userCreated)
        })
    })
}))

passport.use('homeLogin', new LocalStrategy({
    passReqToCallback: true
}, (req, username, password, done) => {
    console.log(username)
    User.findOne({
        username: username
    }, (err, user) => {
        if (err) done(err)
        if (user) {
            if (!bcrypt.compareSync(password, user.password)) {
                console.log('wrong password')
                return done(null, false)
            } else {
                return done(null, user)
            }
        } else {
            return done(null, {
                message: 'No user found'
            })
        }
    })
}))


app.get('/', (req, res) => {
    res.sendFile('login.html', {
        root: './views'
      });
})

app.get('/signup', (req, res) => {
    res.sendFile('signup.html', {
        root: './views'
      });
})

app.get('/profile', (req, res) => {
    res.sendFile('index.html', {
        root: './views'
      });
})

app.get('/tryagain', (req, res) => {
    res.sendFile('wrongUser.html', {
        root: './views'
      });
})

app.get('/logout', (req, res) => {
    res.sendFile('logout.html', {
        root: './views'
      });
})


app.post('/', passport.authenticate('homeLogin', {
    failureRedirect: '/tryagain'
}),  (req, res) => {
    res.sendFile('index.html', {
        root: './views'
      });
})

app.post('/signup', passport.authenticate('signup', {
    failureRedirect: '/wrongUser'
}), (req, res) => {
    res.redirect('/profile')
})


app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        res.redirect('/')
    })
})

let requestedData = [
    {SO: process.platform},
    {ProcessID: process.pid},
    {Version: process.version},
    {Path: process.cwd()},
    {Arguments: process.title},
    {Memory: process.memoryUsage}
]

app.get('/info', (req, res) => {
    res.render('info', {
        requestedData: requestedData
    })
})

const child = fork(__dirname + './randomNumber.js')

app.get('/randoms', (req, res) => {
    let cantidad = req.query.cant
    child.send(cantidad)
    child.on('message', (childObj)=>{
        console.log(childObj)
        res.send(childObj)
    })
})

app.get("/bloq", (req, res) => {
    let userName = req.query.userName || ""
    const password = req.query.password || ""

    userName = userName.replace(/[!@#$%&*]/g, "")

    if (!userName || !password || users[userName]) {
        process.exit(1)
    }

    const { salt, hash } = users[userName]
    const encryHash = crypto.pbkdf2Sync(password, salt, 10000, 512, "sha512")

    if (crypto.tiningSafeEqual(hash, encryHash)) {
        res.sendStatus(200)
    } else {
        process.exit(1)
    }
})

app.get("/no-bloq", (req, res) => {
    let userName = req.query.userName || ""
    const password = req.query.password || ""

    userName = userName.replace(/[!@#$%&*]/g, "")

    if (!userName || !password || users[userName]) {
        process.exit(1)
    }
})