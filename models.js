const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const dbExists = fs.existsSync(dbPath);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath
});

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resetPasswordToken: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resetPasswordExpires: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

const Project = sequelize.define('Project', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

const ProjectFile = sequelize.define('ProjectFile', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('file', 'folder'),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

// Set up associations
User.hasMany(Project);
Project.belongsTo(User);
Project.hasMany(ProjectFile);
ProjectFile.belongsTo(Project);

// Function to create default admin account
async function createDefaultAdmin() {
    try {
        const adminExists = await User.findOne({ where: { username: 'admin' } });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@example.com',
                name: 'Admin User',
                isAdmin: true,
                isVerified: true
            });
            console.log('Default admin account created');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
}

async function syncDatabase() {
    try {
        if (dbExists) {
            console.log('Database already exists. Skipping sync.');
            await sequelize.authenticate();
            console.log('Database connection has been established successfully.');
        } else {
            await sequelize.sync({ force: true });
            console.log('Database synced successfully');
            await createDefaultAdmin();
        }
    } catch (error) {
        console.error('Error syncing database:', error);
    }
}

module.exports = { sequelize, User, Project, ProjectFile, syncDatabase };
