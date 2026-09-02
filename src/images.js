/**
 * images.js — upload handling.
 *
 * Files arrive in memory, are re-encoded to WebP at a fixed aspect ratio and
 * written to uploads/. Nothing the client sends is trusted: the aspect ratio,
 * dimensions, format and file name are all decided here, so a listing grid can
 * never be broken by an odd-sized screenshot.
 */
'use strict';

const path = require('path');
const fsp = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');

const { UPLOADS_DIR } = require('./store');

let sharp;
try {
    sharp = require('sharp');
} catch (err) {
    console.error('\n[boot] FATAL: the "sharp" module is required for image processing.');
    console.error('       Run "npm install" before starting the app.\n');
    process.exit(1);
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_LISTING_IMAGES = 6;

/** Presets keyed by usage, so every surface has predictable geometry. */
const PRESETS = {
    listing: { width: 1600, height: 900, thumb: { width: 640, height: 360 } },
    cover: { width: 1600, height: 900, thumb: { width: 640, height: 360 } },
    'ad-wide': { width: 1440, height: 240, thumb: null },
    'ad-card': { width: 1280, height: 720, thumb: null },
    'ad-portrait': { width: 800, height: 600, thumb: null },
    avatar: { width: 256, height: 256, thumb: null },
};

const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_LISTING_IMAGES },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|jpg|png|webp|gif|avif)$/i.test(file.mimetype)) cb(null, true);
        else cb(Object.assign(new Error('Only JPG, PNG, WebP, GIF or AVIF images are allowed.'), { status: 400 }));
    },
});

function uploadId() {
    return `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
}

/**
 * Re-encode one buffer into a full-size image (and optionally a thumbnail).
 * @returns {{ full: string, thumb: string }} public URLs
 */
async function store(buffer, presetName) {
    const preset = PRESETS[presetName] || PRESETS.listing;
    const id = uploadId();
    const pipeline = sharp(buffer, { animated: false }).rotate();

    await pipeline.clone()
        .resize(preset.width, preset.height, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82, effort: 4 })
        .toFile(path.join(UPLOADS_DIR, `${id}.webp`));

    let thumbUrl = `/uploads/${id}.webp`;
    if (preset.thumb) {
        await pipeline.clone()
            .resize(preset.thumb.width, preset.thumb.height, { fit: 'cover', position: 'centre' })
            .webp({ quality: 72, effort: 4 })
            .toFile(path.join(UPLOADS_DIR, `${id}-t.webp`));
        thumbUrl = `/uploads/${id}-t.webp`;
    }

    return { full: `/uploads/${id}.webp`, thumb: thumbUrl };
}

/** Process an array of multer files; rejects with a 400 on unreadable input. */
async function storeMany(files, presetName) {
    const out = [];
    for (const file of files || []) {
        try {
            // Sequential on purpose: sharp is already multi-threaded and a
            // burst of parallel encodes would starve the event loop.
            // eslint-disable-next-line no-await-in-loop
            out.push(await store(file.buffer, presetName));
        } catch {
            throw Object.assign(
                new Error(`"${file.originalname}" could not be read as an image.`),
                { status: 400 }
            );
        }
    }
    return out;
}

/** Delete uploaded files by public URL. Silently ignores anything already gone. */
async function remove(urls) {
    for (const url of urls || []) {
        if (typeof url !== 'string' || !url.startsWith('/uploads/')) continue;
        try {
            // eslint-disable-next-line no-await-in-loop
            await fsp.unlink(path.join(UPLOADS_DIR, path.basename(url)));
        } catch { /* already removed */ }
    }
}

module.exports = {
    uploader,
    store,
    storeMany,
    remove,
    MAX_LISTING_IMAGES,
    MAX_FILE_BYTES,
    PRESETS,
};
