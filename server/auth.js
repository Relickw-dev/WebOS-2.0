// File: server/auth.js
const bcrypt = require('bcrypt');

const users = {
    'user': {
        groups: ['users'],
        // Parola: 'user'
        passwordHash: '$2b$10$E.M/n9/M4/3R.i.ci.p.G.mdBCu93m1Gj/s.j/k.j/u.s/u.s/e' 
    },
    'root': {
        groups: ['root', 'users'],
        // Parola: 'root'
        passwordHash: '$2b$10$f8.2/aZF23tX7g.aUu2aHeG.x1E.L4238v71l1T58l.EMi3i5.XfG'
    },
    'guest': {
        groups: ['guest'],
        // Parola: 'guest'
        passwordHash: '$2b$10$9s/N5bBIWq4A.59E0jThf.hC7CoS8wz4y4.A.hH/qoY3sOM.xEB1u'
    }
};

/**
 * Verifică dacă un username și o parolă sunt corecte.
 * @param {string} username - Numele de utilizator.
 * @param {string} password - Parola în clar.
 * @returns {Promise<boolean>} - True dacă autentificarea reușește, altfel false.
 */
async function authenticate(username, password) {
    const user = users[username];
    if (!user || !user.passwordHash) {
        return false; // Utilizatorul nu există sau nu are parolă setată
    }
    // Compară parola primită cu hash-ul stocat
    return await bcrypt.compare(password, user.passwordHash);
}

function userExists(username) {
    return username in users;
}

function getUserGroups(username) {
    return users[username]?.groups || [];
}

function getUsers() {
    return Object.keys(users);
}

module.exports = {
    authenticate, // Funcția nouă pentru verificare parolă
    userExists,
    getUserGroups,
    getUsers,
    users 
};