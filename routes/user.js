const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/profile', ensureAuthenticated, (req, res) => {
    res.render('profile', { user: req.user });
});

router.post('/profile', ensureAuthenticated, async (req, res) => {
    try {
        const { name, email } = req.body;
        req.user.name = name;
        req.user.email = email;
        await req.user.save();
        res.redirect('/user/profile');
    } catch (error) {
        console.error('Profile update error:', error);
        res.render('profile', { user: req.user, error: 'Error updating profile' });
    }
});

module.exports = router;
