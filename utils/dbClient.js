const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../db');

async function readJSON(filename) {
    try {
        const filePath = path.join(DB_PATH, filename);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, return empty default based on filename
            if (filename === 'accounts.json') return { users: [] };
            if (filename === 'history.json') return { matches: [] };
            if (filename === 'rooms.json') return { active_rooms: [] };
            return {};
        }
        console.error(`Error reading ${filename}:`, error);
        throw error;
    }
}

async function writeJSON(filename, data) {
    try {
        const filePath = path.join(DB_PATH, filename);
        // Ensure db directory exists
        await fs.mkdir(DB_PATH, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing to ${filename}:`, error);
        throw error;
    }
}

module.exports = {
    readJSON,
    writeJSON
};
