/**
 * routes/auth.js — sign in / out for both admins and resellers.
 * Mounted at /api/auth
 */
'use strict';

const express = require('express');

const store = require('../store');
const auth = require('../auth');
const { text } = require('../util');

const router = express.Router();

/** Shape the "who am I" payload shared by /login and /me. */
function sessionPayload(user) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        status: user.status,
        contacts: user.contacts || {},
        bio_en: user.bio_en || '',
        bio_mm: user.bio_mm || '',
        subscription: store.subscriptionState(user),
        mustChangePassword: Boolean(user.mustChangePassword),
    };
}

router.post('/login', (req, res) => {
    const username = text(req.body && req.body.username, 40);
    const password = (req.body && req.body.password) || '';
    const key = auth.attemptKey(req, username);

    const blockedMs = auth.throttleCheck(key);
    if (blockedMs > 0) {
        return res.status(429).json({
            error: `Too many failed attempts. Try again in ${Math.ceil(blockedMs / 60000)} minute(s).`,
        });
    }

    const users = store.readUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!user || !auth.verifyPassword(password, user.password)) {
        auth.throttleFail(key);
        return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    if (user.status !== 'active') {
        auth.throttleFail(key);
        return res.status(403).json({ error: 'This account is suspended. Contact the administrator.' });
    }

    auth.throttleReset(key);

    // Silently upgrade any hash still using the old sha256 scheme.
    if (auth.isLegacyHash(user.password)) {
        user.password = auth.hashPassword(password);
        store.writeUsers(users);
    }

    const { token, expiresAt } = auth.signToken(user);
    return res.json({ token, expiresAt, user: sessionPayload(user) });
});

router.post('/logout', auth.requireUser, (req, res) => {
    auth.revokeToken(req.token);
    res.json({ ok: true });
});

router.get('/me', auth.requireUser, (req, res) => {
    res.json({ user: sessionPayload(req.user) });
});

module.exports = { router, sessionPayload };
