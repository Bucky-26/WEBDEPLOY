const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { User, Project } = require('../models');
const { ensureAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/email');
const { startProjectServer, stopProjectServer } = require('../utils/projectManager');

router.get('/', ensureAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const { count, rows: users } = await User.findAndCountAll({
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        const projects = await Project.findAll({
            include: [{ model: User, attributes: ['username'] }],
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        const totalPages = Math.ceil(count / limit);

        res.render('admin', { 
            user: req.user, 
            users, 
            projects, 
            currentPage: page, 
            totalPages,
            messages: req.flash() // Add this line
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});

router.post('/create', ensureAdmin, async (req, res) => {
    try {
        const { username, email, password, name } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            email,
            password: hashedPassword,
            name,
            isAdmin: true,
            isVerified: true
        });
        res.redirect('/admin');
    } catch (error) {
        console.error('Error creating admin account:', error);
        res.status(400).json({ error: 'Admin account creation failed' });
    }
});

router.post('/verify/:id', ensureAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
        res.redirect('/admin');
    } catch (error) {
        console.error('Error verifying user:', error);
        res.status(500).json({ error: 'Error verifying user' });
    }
});

router.post('/toggle-admin/:id', ensureAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.isAdmin = !user.isAdmin;
        await user.save();
        res.redirect('/admin');
    } catch (error) {
        console.error('Error toggling admin status:', error);
        res.status(500).json({ error: 'Error toggling admin status' });
    }
});

router.post('/delete/:id', ensureAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await user.destroy();
        res.redirect('/admin');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

router.post('/send-notification', ensureAdmin, async (req, res) => {
    try {
        const { subject, message, recipients } = req.body;
        
        // Ensure recipients is always an array
        const recipientIds = Array.isArray(recipients) ? recipients : [recipients];

        const users = await User.findAll({
            where: {
                id: {
                    [Op.in]: recipientIds
                }
            }
        });

        for (const user of users) {
            await sendEmail(user.email, subject, message);
        }

        req.flash('success', 'Notification sent successfully');
        res.redirect('/admin');
    } catch (error) {
        console.error('Error sending notification:', error);
        req.flash('error', 'Error sending notification');
        res.redirect('/admin');
    }
});

// Add a new route for search functionality
router.get('/search', ensureAdmin, async (req, res) => {
    try {
        const { query, type } = req.query;
        let results;

        if (type === 'users') {
            results = await User.findAll({
                where: {
                    [Op.or]: [
                        { username: { [Op.like]: `%${query}%` } },
                        { email: { [Op.like]: `%${query}%` } },
                        { name: { [Op.like]: `%${query}%` } }
                    ]
                }
            });
        } else if (type === 'projects') {
            results = await Project.findAll({
                where: {
                    name: { [Op.like]: `%${query}%` }
                },
                include: [{ model: User, attributes: ['username'] }]
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.post('/pause-project/:id', ensureAdmin, async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) {
            req.flash('error', 'Project not found');
            return res.redirect('/admin');
        }

        if (!project.deployed) {
            req.flash('error', 'Project is already paused');
            return res.redirect('/admin');
        }

        await stopProjectServer(project);
        project.deployed = false;
        await project.save();

        req.flash('success', `Project ${project.name} has been paused`);
        res.redirect('/admin');
    } catch (error) {
        console.error('Error pausing project:', error);
        req.flash('error', 'Error pausing project');
        res.redirect('/admin');
    }
});

router.post('/start-project/:id', ensureAdmin, async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) {
            req.flash('error', 'Project not found');
            return res.redirect('/admin');
        }

        if (project.deployed) {
            req.flash('error', 'Project is already running');
            return res.redirect('/admin');
        }

        await startProjectServer(project);
        project.deployed = true;
        await project.save();

        req.flash('success', `Project ${project.name} has been started`);
        res.redirect('/admin');
    } catch (error) {
        console.error('Error starting project:', error);
        req.flash('error', 'Error starting project');
        res.redirect('/admin');
    }
});

module.exports = router;
