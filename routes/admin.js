const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { ensureAdmin } = require('../middleware/auth');

router.get('/', ensureAdmin, async (req, res) => {
    try {
        const users = await User.findAll();
        res.render('admin', { user: req.user, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error fetching users');
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

module.exports = router;
