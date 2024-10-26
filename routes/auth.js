const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../models');
const { sendEmail } = require('../utils/email');

// Add this middleware function at the top of the file
function ensureVerified(req, res, next) {
    if (req.isAuthenticated() && !req.user.isVerified) {
        return res.redirect('/account-not-verified');
    }
    next();
}

router.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('error') || [] });
});

router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
}), ensureVerified, (req, res) => {
    res.redirect('/');
});

router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword, name } = req.body;
        
        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match' });
        }

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.render('register', { error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(20).toString('hex');
        
        await User.create({
            username,
            email,
            password: hashedPassword,
            name,
            verificationToken
        });

        const verificationUrl = `http://${req.headers.host}/verify-email/${verificationToken}`;
        await sendEmail(email, 'Verify your email', `Click <a href="${verificationUrl}">here</a> to verify your email.`);

        res.render('login', { messages: ['Registration successful. Please check your email to verify your account.'] });
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});

router.get('/verify-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({ where: { verificationToken: req.params.token } });
        if (!user) {
            return res.status(400).send('Invalid or expired verification token');
        }
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
        res.redirect('/login');
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send('Error verifying email');
    }
});

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { error: null, message: null });
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.render('forgot-password', { error: 'No account with that email address exists.', message: null });
        }
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `http://${req.headers.host}/reset-password/${resetToken}`;
        await sendEmail(user.email, 'Password Reset', `Click <a href="${resetUrl}">here</a> to reset your password.`);

        res.render('forgot-password', { error: null, message: 'An email has been sent with further instructions.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('forgot-password', { error: 'An error occurred. Please try again.', message: null });
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            where: {
                resetPasswordToken: req.params.token,
                resetPasswordExpires: { [Op.gt]: Date.now() }
            }
        });
        if (!user) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }
        res.render('reset-password', { token: req.params.token, error: null });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).send('Error resetting password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            where: {
                resetPasswordToken: req.params.token,
                resetPasswordExpires: { [Op.gt]: Date.now() }
            }
        });
        if (!user) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            return res.render('reset-password', { token: req.params.token, error: 'Passwords do not match' });
        }
        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        res.redirect('/login');
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).send('Error resetting password');
    }
});

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');
    });
});

// Add a new route for unverified accounts
router.get('/account-not-verified', (req, res) => {
    res.render('account-not-verified', { email: req.user ? req.user.email : null });
});

// Add a route to resend verification email
router.post('/resend-verification', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    try {
        const verificationToken = crypto.randomBytes(20).toString('hex');
        req.user.verificationToken = verificationToken;
        await req.user.save();

        const verificationUrl = `http://${req.headers.host}/verify-email/${verificationToken}`;
        await sendEmail(req.user.email, 'Verify your email', `Click <a href="${verificationUrl}">here</a> to verify your email.`);

        res.render('account-not-verified', { email: req.user.email, message: 'Verification email resent. Please check your inbox.' });
    } catch (error) {
        console.error('Error resending verification email:', error);
        res.render('account-not-verified', { email: req.user.email, error: 'Failed to resend verification email. Please try again.' });
    }
});

module.exports = router;
