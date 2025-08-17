/**********************
Written by Sam Stankiewicz ('26) for Jefferson Policy Debate.
*********************/

import { } from "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import path from "path";
import session from 'express-session';
import passport from "passport";
import flash from 'express-flash';
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import crypto from 'crypto';
import axios from 'axios';

import Utils from './utils.js';
import EmailService from './emailService.js';

import User from './schemas/userSchema.js';
import Tournament from './schemas/tournamentSchema.js';
import Lecture from './schemas/lectureSchema.js';

import IonStrategy from './ionStrategy.js';

const PORT = process.env.PORT || 3000;
const app = express();

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

app.use(express.static(path.join(_dirname, "../static")));
app.use(express.static("static"));
app.use(express.static("static/css"));
app.use(express.static("static/images"));
app.use(express.static("static/scripts"));
app.use(express.static("views/partials"));
app.set("view engine", "ejs");
app.set("views", path.join(_dirname, 'views'));

import mongoose from 'mongoose';
mongoose.set("strictQuery", false);
mongoose.connect(process.env.DBURI);

app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(20).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// S3 Configuration
const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLAREACCOUNTID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLAREACCESSKEY,
        secretAccessKey: process.env.CLOUDFLARESECRETACCESSKEY,
    },
});

const upload = multer({
    storage: multerS3({
        s3: S3,
        bucket: "normaldebate",
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${uuid()}${ext}`);
        },
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, //5MB
    },
    fileFilter: function (_req, file, cb) {
        checkFileType(file, cb);
    }
});

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = filetypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        return cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and GIF files are allowed.'));
    }
}

passport.use(IonStrategy);

passport.serializeUser(function (user, done) {
    done(null, user.username || user._doc?.username);
});

passport.deserializeUser(async function (username, done) {
    try {
        const user = await User.findOne({ username: username });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

app.use((req, res, next) => {
    next();
});

app.get('/', Utils.ensureNotLogin, async (req, res) => {

    res.render('index', {
        user: req.user || null
    });

});

app.get('/auth/ion', (req, res, next) => {
    passport.authenticate('ion')(req, res, next);
});

app.get('/auth/ion/callback', 
    (req, res, next) => {
        
        passport.authenticate('ion', { 
            failureRedirect: '/login?error=ion_auth_failed',
            failureFlash: true 
        })(req, res, next);

    },
    async (req, res) => {
        
        try {

            if (!req.user) {
                console.error('[Ion Callback] No user object from Ion strategy');
                return res.redirect('/login?error=no_user_data');
            }

            let user = await User.findOne({ 
                username: req.user.username 
            });
            
            if (!user) {

                const now = Date.now();
                
                user = new User({
                    email: req.user.email,
                    name: req.user.fullName || `${req.user.firstName} ${req.user.lastName}`,
                    profilePic: "/defaultPic.svg",
                    registerTime: now,
                    lastLogin: now,
                    username: req.user.username,
                    fees: [],
                    settings: {},
                    tournaments: [],
                    role: {
                        type: 'novice',
                        grade: req.user.grade,
                        officer: false,
                        defaultPartner: ''
                    }
                });
                
                await user.save();
                
                try {
                    if (EmailService && EmailService.sendWelcomeEmail) {
                        await EmailService.sendWelcomeEmail(
                            user.email, 
                            user.name,
                            { grade: req.user.grade }
                        );
                    }
                } catch (error) {
                    console.error('[Ion Callback] Failed to send welcome email:', error.message);
                }

            } else {

                user.lastLogin = Date.now();

                if (req.user.grade) {
                    user.settings = user.settings || {};
                    user.settings.grade = req.user.grade;
                }

                await user.save();

            }
            
            req.session.ionTokens = {
                accessToken: req.user.accessToken,
                refreshToken: req.user.refreshToken
            };
            
            
            req.logIn(user, (err) => {
                if (err) {
                    console.error('[Ion Callback] Login error:', err);
                    return res.redirect('/login?error=login_failed');
                }
                                
                req.session.save((err) => {
                    if (err) {
                        console.error('[Ion Callback] Session save error:', err);
                    }
                    
                    const returnTo = req.session.returnTo || '/home';
                    delete req.session.returnTo;

                    res.redirect(returnTo);

                });
            });
            
        } catch (error) {
            console.error('[Ion Callback] Error processing callback:', error);
            res.redirect('/login?error=oauth_processing_failed');
        }
    }
);

function onOffToBool(str) {
    if (typeof str !== "string") return false;
    return str.toLowerCase() === "on";
}

app.post('/postLecture', Utils.ensureOfficer, (req, res) => {

    if (!req.body.title || !req.body.date || !req.body.url || !req.body.protected) {

        return res.redirect('/postLecture');

    }

    let url = req.body.url;

    if (!req.body.url.toLowerCase().includes('http')) {

        url = 'https://' + req.body.url;

    }

    const lecture = new Lecture({
        title: req.body.title,
        date: req.body.date,
        datePosted: new Date(),
        poster: req.user.username,
        url: url,
        isProtected: onOffToBool(req.body.protected)
    });

    lecture.save();

    return res.redirect('/');

});

app.get('/login', Utils.ensureNotLogin, (req, res) => {
    res.render('login', {
        error: req.query.error || null
    });
});

app.get('/register', Utils.ensureNotLogin, (req, res) => {
    res.render('register', {
        error: req.query.error || null
    });
});

app.get('/logout', (req, res, next) => {
    const username = req.user ? req.user.username : 'unknown';
    req.logout(function (err) {
        if (err) {
            console.error('[Logout] Error:', err);
            return next(err);
        }
        res.redirect('/');
    });
});

app.get('/profile', Utils.ensureLogin, (req, res) => {
    res.render('profile', {
        user: req.user
    });
});

const uploadProfileImage = upload.single("profilePicture");
app.post("/changeProfilePicture", Utils.ensureLogin, async (req, res) => {
    uploadProfileImage(req, res, async function (err) {
        if (err) {
            console.log("Error validating and uploading profile picture: " + err);
            return res.redirect('/profile?error=' + encodeURIComponent(err.message || 'Upload failed'));
        }
        
        if (!req.file) {
            return res.redirect('/profile?error=No file uploaded');
        }
        
        try {
            await User.findOneAndUpdate({_id: req.user.id}, {
                profilePic: process.env.PUBLICR2 + '/' + req.file.key
            });
            
            return res.redirect('/profile');
        } catch (err) {
            console.log("Error uploading new profile picture: " + err);
            return res.redirect("/profile?error=Database update failed");
        }
    });
});

async function getUpcomingTournaments() {
    try {
        const now = new Date();
        const tournaments = await Tournament.find({
            date: { $gte: now }
        })
        .sort({ date: 1 })
        .lean();
        
        return tournaments;
    } catch (error) {
        console.error('Error fetching upcoming tournaments:', error);
        return [];
    }
}

async function getOpenTournaments() {
    try {
        const now = new Date();
        const tournaments = await Tournament.find({
            date: { $gte: now },
            signupDeadline: { $gte: now }
        })
        .sort({ date: 1 })
        .lean();
        
        return tournaments;
    } catch (error) {
        console.error('Error fetching open tournaments:', error);
        return [];
    }
}

async function getAvailableTournaments() {
    try {
        const now = new Date();
        const tournaments = await Tournament.find({
            date: { $gte: now },
            signupDeadline: { $gte: now },
            $expr: {
                $lt: [{ $size: '$signups' }, '$maxParticipants']
            }
        })
        .sort({ date: 1 })
        .lean();
        
        return tournaments;
    } catch (error) {
        console.error('Error fetching available tournaments:', error);
        return [];
    }
}

async function getUserTournaments(username) {
    try {
        const now = new Date();
        const tournaments = await Tournament.find({
            date: { $gte: now },
            signups: username
        })
        .sort({ date: 1 })
        .lean();
        
        return tournaments;
    } catch (error) {
        console.error('Error fetching user tournaments:', error);
        return [];
    }
}

async function getFilteredTournaments(options = {}) {
    try {
        const {
            page = 1,
            limit = 10,
            type = null,
            showPast = false,
            onlyAvailable = false
        } = options;
        
        const query = {};
        const now = new Date();
        
        if (!showPast) {
            query.date = { $gte: now };
        }
        
        if (type) {
            query.type = type;
        }
        
        if (onlyAvailable) {
            query.signupDeadline = { $gte: now };
            query.$expr = {
                $lt: [{ $size: '$signups' }, '$maxParticipants']
            };
        }
        
        const tournaments = await Tournament.find(query)
            .sort({ date: 1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await Tournament.countDocuments(query);
        
        return {
            tournaments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    } catch (error) {
        console.error('Error fetching filtered tournaments:', error);
        return {
            tournaments: [],
            totalPages: 0,
            currentPage: 1,
            total: 0
        };
    }
}

app.get('/officers', (req, res) => {
    res.render('officers', {
        user: req.user || null
    });
});

app.get('/feeSummary', Utils.ensureOfficer, (req, res) => {
    res.render('feePortal', {
        user: req.user || null
    });
});

app.get('/contact', (req, res) => {
    res.render('contact', {
        user: req.user || null
    });
});

app.get('/constitution', Utils.ensureLogin, (req, res) => {
    res.render('constitution', {
        user: req.user
    });
});

app.get('/resources', (req, res) => {
    res.render('resources', {
        user: req.user || null
    });
});

app.get('/calendar', (req, res) => {
    res.render('calendar', {
        user: req.user || null
    });
});

async function getAllLectures() {
    try {
        const lectures = await Lecture.find({})
            .sort({ date: -1 })
            .lean();
        
        return lectures;
    } catch (error) {
        console.error('Error fetching all lectures:', error);
        return [];
    }
}

async function getRecentLectures(limit = 3) {
    try {
        const lectures = await Lecture.find({})
            .sort({ date: -1 })
            .limit(limit)
            .lean();
        
        return lectures;
    } catch (error) {
        console.error('Error fetching recent lectures:', error);
        return [];
    }
}

async function getPublicLectures() {
    try {
        const lectures = await Lecture.find({ isProtected: false })
            .sort({ date: -1 })
            .lean();
        
        return lectures;
    } catch (error) {
        console.error('Error fetching public lectures:', error);
        return [];
    }
}

async function getLecturesByPoster(posterUsername) {
    try {
        const lectures = await Lecture.find({ poster: posterUsername })
            .sort({ date: -1 })
            .lean();
        
        return lectures;
    } catch (error) {
        console.error('Error fetching lectures by poster:', error);
        return [];
    }
}

async function getLecturesByDateRange(startDate, endDate) {
    try {
        const lectures = await Lecture.find({
            date: {
                $gte: startDate,
                $lte: endDate
            }
        })
        .sort({ date: -1 })
        .lean();
        
        return lectures;
    } catch (error) {
        console.error('Error fetching lectures by date range:', error);
        return [];
    }
}

async function getPaginatedLectures(page = 1, limit = 10, filters = {}) {
    try {
        const query = {};
        
        if (filters.isProtected !== undefined) {
            query.isProtected = filters.isProtected;
        }
        
        if (filters.poster) {
            query.poster = filters.poster;
        }
        
        if (filters.startDate || filters.endDate) {
            query.date = {};
            if (filters.startDate) query.date.$gte = filters.startDate;
            if (filters.endDate) query.date.$lte = filters.endDate;
        }
        
        const lectures = await Lecture.find(query)
            .sort({ date: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await Lecture.countDocuments(query);
        
        return {
            lectures,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        };
    } catch (error) {
        console.error('Error fetching paginated lectures:', error);
        return {
            lectures: [],
            totalPages: 0,
            currentPage: 1,
            total: 0
        };
    }
}

app.get('/home', Utils.ensureLogin, async (req, res) => {

    const tourneys = await getOpenTournaments();
    const lectures = await getRecentLectures();

    let hasFees = false;
    let feeTotal = 0;

    for (let x = 0; x < req.user.fees.length; x++) {

        if (!req.user.fees[x].paid) {
            hasFees = true;
            feeTotal += req.user.fees[x].amount;
        }

    }

    res.render('home', {
        user: req.user,
        tournaments: tourneys,
        hasOutstandingFees: hasFees,
        outstandingFees: feeTotal,
        lectures: lectures
    });

});

app.get('/tournaments', Utils.ensureOfficer, (req, res) => {

    res.render('touraments', {
        user: req.user
    });

});

app.get('/tournament/:id', Utils.ensureLogin, async (req, res) => {

    res.render('tournament', {
        user: req.user
    });

});

app.get('/about', (req, res) => {
    res.render('about', {
        user: req.user || null
    });
});

app.get('/finances', Utils.ensureOfficer, (req, res) => {
    res.render('finances', {
        user: req.user || null
    });
});

app.get('/tournamentPortal', Utils.ensureOfficer, (req, res) => {
    res.render('tournamentPortal', {
        user: req.user || null
    });
});

app.get('/postLecture', Utils.ensureOfficer, (req, res) => {
    res.render('postLecture', {
        user: req.user || null
    });
});

app.get('/roster', Utils.ensureOfficer, async (req, res) => {

    const users = await User.find({})
        .select('name profilePic username role')
        .lean();
    
    const sortedUsers = users.sort((a, b) => {

        const gradeA = a.role?.grade || 0;
        const gradeB = b.role?.grade || 0;
        
        if (gradeA !== gradeB) {
            return gradeB - gradeA;
        }
        
        return (a.name || '').localeCompare(b.name || '');

    });
    
    const usersByGrade = {
        12: [],
        11: [],
        10: [],
        9: [],
        other: []
    };
    
    sortedUsers.forEach(user => {
        const grade = user.role?.grade;
        if (grade >= 9 && grade <= 12) {
            usersByGrade[grade].push(user);
        } else {
            usersByGrade.other.push(user);
        }
    });
    
    res.render('roster', {
        user: req.user,
        allUsers: sortedUsers,
        usersByGrade: usersByGrade,
        totalUsers: users.length
    });

});

app.get('/judgeRegistry', Utils.ensureOfficer, (req, res) => {
    res.render('judges', {
        user: req.user || null
    });
});

app.get('/demote/:username', Utils.ensureOfficer, async (req, res) => {

    const user = await User.findOne({ username: req.params.username });
    
    let nextRole = 'novice';

    if (user) {
        if (user.role.type == 'novice' || user.role.type == 'JV') {
            nextRole = 'novice';
        } else if (user.role.type == 'varsity') {
            nextRole = 'JV';
        }
    }

    res.render('demoteUser', {
        user: req.user || null,
        newRole: nextRole,
        currentRole: user.role.type,
        username: user.username
    });

});

app.post('/demote', Utils.ensureOfficer, async (req, res) => {

    const user = await User.findOne({ username: req.body.username });
    
    let nextRole = 'novice';

    
    if (user) {
     
        let roleTemp = user.role;
        
        if (user.role.type == 'novice' || user.role.type == 'JV') {
            nextRole = 'novice';
        } else if (user.role.type == 'varsity') {
            nextRole = 'JV';
        }

        roleTemp.type = nextRole;
        
        await User.findOneAndUpdate({ username: req.body.username }, {
            role: roleTemp
        });

        return res.redirect('/roster');

    } else {

        console.log("Error finding user for demotion");

        return res.redirect('/roster');
    
    }
    
});

app.get('/promote/:username', Utils.ensureOfficer, async (req, res) => {

    const user = await User.findOne({ username: req.params.username });
    
    let nextRole = 'JV';

    if (user) {
        if (user.role.type == 'novice') {
            nextRole = 'JV';
        } else if (user.role.type == 'JV') {
            nextRole = 'varsity';
        }
    }

    res.render('promoteUser', {
        user: req.user || null,
        newRole: nextRole,
        currentRole: user.role.type,
        username: user.username
    });

});

app.post('/promote', Utils.ensureOfficer, async (req, res) => {

    const user = await User.findOne({ username: req.body.username });
    
    let nextRole = 'JV';
    
    if (user) {
     
        let roleTemp = user.role;
        
        if (user.role.type == 'novice') {
            nextRole = 'JV';
        } else if (user.role.type == 'JV') {
            nextRole = 'varsity';
        }

        roleTemp.type = nextRole;
        
        await User.findOneAndUpdate({ username: req.body.username }, {
            role: roleTemp
        });

        return res.redirect('/roster');

    } else {

        console.log("Error finding user for promotion");

        return res.redirect('/roster');
    
    }
    
});

app.post('/kick', Utils.ensureOfficer, async (req, res) => {
    
    await User.findOneAndDelete({ username: req.body.username });

    return res.redirect('/roster');

});

app.get('/kick/:id', Utils.ensureOfficer, async (req, res) => {

    const user = await User.findOne({ username: req.params.id });
    
    if (user) {
        
        res.render('kickUser', {
            user: req.user || null,
            username: user.username
        });
    
    } else {
        console.log("Couldn't find user to kick");
        return res.redirect('/');
    }

});

app.get("/getUserInfo", async (req, res) => {
    try {
        return res.json(await User.findById(req.query.id)
            .select('-settings -lastLogin -_id')
            .lean()
        );
    } catch (err) {
        console.log("Error finding user: " + err);
        return res.json({});
    }
});

app.post('/changeSettings', Utils.ensureLogin, async (req, res) => {
    const publicity = req.body.publicity;
    const country = req.body.country;
    const email = req.body.email;

    const settingsTemp = {
        darkMode: false,
        profilePublicity: publicity,
        country: country,
        emailPreference: email
    };
    
    await User.updateOne({username: req.user.username}, {
        settings: settingsTemp
    });

    return res.sendStatus(200);
});

app.delete('/deleteUser', Utils.ensureLogin, async (req, res, next) => {
    try {
        await User.deleteOne({ _id: req.user._id });
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
            res.redirect('/');
        });
    } catch (err) {
        console.log("Error deleting profile: " + err);
        return res.redirect('/');
    }
});

app.get(/(.*)/, (req, res) => {
    console.log("Loading 404 for " + req.protocol + '://' + req.get('host') + req.originalUrl);
    res.render('404', {
        user: req.user || null
    });
});

mongoose.connection.once("open", () => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});