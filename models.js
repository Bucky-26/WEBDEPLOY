const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
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
    isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

const Project = sequelize.define('Project', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
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
    const adminPassword = 'admin';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    try {
        await User.create({
            username: 'admin',
            password: hashedPassword,
            isAdmin: true
        });
        console.log('Default admin account created successfully');
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log('Default admin account already exists');
        } else {
            console.error('Error creating default admin account:', error);
        }
    }
}

// Sync the models with the database
async function syncDatabase() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully');
        await createDefaultAdmin();
    } catch (error) {
        console.error('Error syncing database:', error);
    }
}

module.exports = { sequelize, User, Project, ProjectFile, syncDatabase };
