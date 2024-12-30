import rateLimit from 'express-rate-limit';

export default ({ cache, config }) => rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.dotEnv.ENV === 'production' ? 100 : 1000,
    message: {
        ok: false,
        errors: ['Too many requests, please try again later.']
    }
});