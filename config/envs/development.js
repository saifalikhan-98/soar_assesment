export const cors = {
    origin: ['http://localhost:3000'],
    credentials: true
};
export const rateLimiter = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
};
export const security = {
    jwtExpirationLong: '7d',
    jwtExpirationShort: '24h',
    bcryptRounds: 10
};
export const monitoring = {
    logLevel: 'debug',
    performance: true
};