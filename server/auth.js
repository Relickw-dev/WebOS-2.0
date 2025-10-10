// File: server/auth.js

const users = {
    'user': { groups: ['users'] },
    'root': { groups: ['root', 'users'] },
    'guest': { groups: ['guest'] }
};

function userExists(username) {
    return username in users;
}

function getUserGroups(username) {
    return users[username]?.groups || [];
}

// Funcție nouă exportată
function getUsers() {
    return Object.keys(users);
}

module.exports = {
    userExists,
    getUserGroups,
    getUsers, // Exportăm funcția
    users // Exportăm direct pentru server.js
};