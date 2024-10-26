const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'mail.ghost-ph.cloud',
    port: 587,
    secure: false,
    auth: {
        user: 'auth@ghost-ph.cloud',
        pass: 'Isoy152020'
    },
    tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
    }
});

async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: '"Static Site Deployer" <auth@ghost-ph.cloud>',
            to,
            subject,
            html
        });
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

module.exports = { sendEmail };
