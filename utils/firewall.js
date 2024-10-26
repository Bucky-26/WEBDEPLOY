const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function allowPort(port) {
    try {
        // Check if UFW is installed
        await execAsync('which ufw');
        
        // Allow the port
        await execAsync(`sudo ufw allow ${port}`);
        console.log(`Port ${port} has been allowed in firewall`);
        
        // Reload UFW to apply changes
        await execAsync('sudo ufw reload');
        return true;
    } catch (error) {
        console.error('Error managing firewall:', error);
        return false;
    }
}

module.exports = { allowPort };
