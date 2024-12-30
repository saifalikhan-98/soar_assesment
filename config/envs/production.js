export const cors = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [],
    credentials: true
};
export const rateLimiter = {
    windowMs: 15 * 60 * 1000,
    max: 60
};
export const security = {
    jwtExpirationLong: '30d',
    jwtExpirationShort: '12h',
    bcryptRounds: 12
};
export const monitoring = {
    logLevel: 'error',
    performance: false
};