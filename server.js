        require('dotenv').config();

        const express = require('express');
        const session = require('express-session');
        const passport = require('passport');
        const LocalStrategy = require('passport-local').Strategy;
        const flash = require('connect-flash');
        const path = require('path');
        const fileUpload = require('express-fileupload');
        const bcrypt = require('bcrypt');
        const { sequelize, User, syncDatabase } = require('./models');
        const { generateSecret } = require('./utils/auth');
        const crypto = require('crypto');

        // Generate a random secret key
        const generateSecretKey = () => {
            return crypto.randomBytes(64).toString('hex');
        };

        const secretKey = generateSecretKey();

        // Import routes
        const authRoutes = require('./routes/auth');
        const adminRoutes = require('./routes/admin');
        const projectRoutes = require('./routes/project');
        const userRoutes = require('./routes/user');
        const projectModule = require('./routes/api/project');
        const fileRoutes = require('./routes/api/file');

        const app = express();
        const port = process.env.PORT || 3005;

        // Middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false
        }));
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(flash());

        // Set up EJS as the view engine
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));

        // Serve static files
        app.use(express.static(path.join(__dirname, 'public')));



        passport.use(new LocalStrategy(async (username, password, done) => {
            try {
                const user = await User.findOne({ where: { username } });
                if (!user) {
                    return done(null, false, { message: 'Incorrect username.' });
                }
                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }));

        passport.serializeUser((user, done) => {
            done(null, user.id);
        });

        passport.deserializeUser(async (id, done) => {
            try {
                const user = await User.findByPk(id);
                done(null, user);
            } catch (err) {
                done(err);
            }
        });

        // Use the routes
        app.use('/', authRoutes);
        app.use('/admin', adminRoutes);
        app.use('/projects', projectRoutes);
        app.use('/user', userRoutes);
        app.use('/api/projects', projectModule.router);

        // Move the file routes to the end
        app.use('/api/files', fileRoutes);

        // Home route
        app.get('/', (req, res) => {
            if (req.isAuthenticated()) {
                res.redirect('/projects');
            } else {
                res.redirect('/login');
            }
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });

        // 404 handler
        app.use((req, res, next) => {
            res.status(404).send("Sorry, can't find that!");
        });

        async function startServer() {
            try {
                await syncDatabase();
                await projectModule.deployAllProjects();
                app.listen(port, () => {
                    console.log(`Server running on port ${port}`);
                });
            } catch (error) {
                console.error('Error starting server:', error);
            }
        }

        startServer();

        module.exports = app;
