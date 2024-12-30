import crypto from 'crypto';
import bcrypt from 'bcrypt';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';


/**
 * Convert string to URL-friendly slug
 * @param {string} str String to slugify
 * @returns {string} Slugified string
 * @throws {Error} If input is not a string
 */
export const slugify = (str) => {
    if (typeof str !== 'string') {
        throw new Error('Input must be a string');
    }
    
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Generate random string of specified length
 * @param {number} length Length of string to generate
 * @returns {string} Random string
 * @throws {Error} If length is not a positive number
 */
export const generateRandomString = (length = 32) => {
    if (!Number.isInteger(length) || length <= 0) {
        throw new Error('Length must be a positive integer');
    }
    
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
};

/**
 * Hash password using bcrypt
 * @param {string} password Password to hash
 * @param {number} rounds Number of bcrypt rounds
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If password is empty or rounds is invalid
 */
export const hashPassword = async (password, rounds = 10) => {
    if (!password) {
        throw new Error('Password is required');
    }
    
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 31) {
        throw new Error('Rounds must be between 1 and 31');
    }
    
    return bcrypt.hash(password, rounds);
};

/**
 * Verify password against hash
 * @param {string} password Password to verify
 * @param {string} hash Hash to verify against
 * @returns {Promise<boolean>} Whether password matches hash
 * @throws {Error} If password or hash is empty
 */
export const verifyPassword = async (password, hash) => {
    if (!password || !hash) {
        throw new Error('Password and hash are required');
    }
    
    return bcrypt.compare(password, hash);
};

/**
 * Encrypt data using NACL
 * @param {any} data Data to encrypt
 * @param {string} secret Secret key
 * @returns {string} Encrypted data
 * @throws {Error} If data or secret is invalid
 */
export const encrypt = (data, secret) => {
    if (!data || !secret) {
        throw new Error('Data and secret key are required');
    }
    
    try {
        const keyUint8Array = naclUtil.decodeBase64(secret);
        if (keyUint8Array.length !== nacl.secretbox.keyLength) {
            throw new Error('Invalid secret key length');
        }
        
        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
        const messageUint8 = naclUtil.decodeUTF8(JSON.stringify(data));
        const box = nacl.secretbox(messageUint8, nonce, keyUint8Array);

        const fullMessage = new Uint8Array(nonce.length + box.length);
        fullMessage.set(nonce);
        fullMessage.set(box, nonce.length);

        return naclUtil.encodeBase64(fullMessage);
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
};

/**
 * Decrypt data using NACL
 * @param {string} encryptedData Data to decrypt
 * @param {string} secret Secret key
 * @returns {any} Decrypted data
 * @throws {Error} If decryption fails or data is invalid
 */
export const decrypt = (encryptedData, secret) => {
    if (!encryptedData || !secret) {
        throw new Error('Encrypted data and secret key are required');
    }
    
    try {
        const keyUint8Array = naclUtil.decodeBase64(secret);
        if (keyUint8Array.length !== nacl.secretbox.keyLength) {
            throw new Error('Invalid secret key length');
        }
        
        const messageWithNonceAsUint8Array = naclUtil.decodeBase64(encryptedData);
        const nonce = messageWithNonceAsUint8Array.slice(0, nacl.secretbox.nonceLength);
        const message = messageWithNonceAsUint8Array.slice(
            nacl.secretbox.nonceLength,
            messageWithNonceAsUint8Array.length
        );

        const decrypted = nacl.secretbox.open(message, nonce, keyUint8Array);
        if (!decrypted) {
            throw new Error('Could not decrypt message');
        }

        return JSON.parse(naclUtil.encodeUTF8(decrypted));
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
};

/**
 * Validate email format
 * @param {string} email Email to validate
 * @returns {boolean} Whether email is valid
 * @throws {Error} If email is not a string
 */
export const isValidEmail = (email) => {
    if (typeof email !== 'string') {
        throw new Error('Email must be a string');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

/**
 * Format date to ISO string without milliseconds
 * @param {Date} date Date to format
 * @returns {string} Formatted date
 * @throws {Error} If input is not a valid date
 */
export const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        throw new Error('Input must be a valid Date object');
    }
    
    return date.toISOString().split('.')[0] + 'Z';
};

/**
 * Generate a secure random token
 * @param {number} length Length of token
 * @returns {string} Random token
 */
export const generateToken = (secret, user) => {
    return jwt.sign({ 
                        id: user._id,
                        role: user.role,
                        schoolId: user.schoolId
                    },
                    secret,
                    { expiresIn: '7d' }
                    );
};

/**
 * Verify JWT token
 * @param {string} token JWT token to verify
 * @param {string} secret Secret key to verify against
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or verification fails
 */
export const verifyJwtToken = (token, secret) => {
    if (!token) {
        throw new Error('Token is required');
    }
    
    if (!secret) {
        throw new Error('Secret key is required');
    }
    
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            throw new Error('Invalid token');
        } else if (error instanceof jwt.TokenExpiredError) {
            throw new Error('Token has expired');
        } else if (error instanceof jwt.NotBeforeError) {
            throw new Error('Token not yet active');
        }
        throw new Error(`Token verification failed: ${error.message}`);
    }
};

/**
 * Sanitize string by removing special characters
 * @param {string} str String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (str) => {
    if (typeof str !== 'string') {
        throw new Error('Input must be a string');
    }
    
    return str.replace(/[^\w\s-]/g, '').trim();
};

/**
 * Check if a string is a valid MongoDB ObjectId
 * @param {string} str String to check
 * @returns {boolean} Whether string is a valid ObjectId
 */
export const isValidObjectId = (str) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(str);
};

/**
 * Format phone number to consistent format
 * @param {string} phone Phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
    if (typeof phone !== 'string') {
        throw new Error('Phone must be a string');
    }
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as: +X-XXX-XXX-XXXX or XXX-XXX-XXXX
    if (cleaned.length === 11) {
        return `+${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    throw new Error('Invalid phone number format');
};

export const toObjectId = (id) => {
    if (!id || !ObjectId.isValid(id)) {
        throw new Error('Invalid ID format');
    }
    return new ObjectId(id.toString());
};