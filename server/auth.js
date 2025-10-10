// File: server/auth.js

// O listă simplă de utilizatori și grupurile din care fac parte.
// Într-o aplicație reală, aceștia ar veni dintr-o bază de date.
const users = {
    'user': { groups: ['users'] },
    'root': { groups: ['root', 'users'] },
    'guest': { groups: ['guest'] }
};

/**
 * Verifică dacă un utilizator există.
 * @param {string} username - Numele de utilizator.
 * @returns {boolean}
 */
function userExists(username) {
    return username in users;
}

/**
 * Returnează grupurile unui utilizator.
 * @param {string} username - Numele de utilizator.
 * @returns {string[]}
 */
function getUserGroups(username) {
    return users[username]?.groups || [];
}

module.exports = {
    userExists,
    getUserGroups,
};