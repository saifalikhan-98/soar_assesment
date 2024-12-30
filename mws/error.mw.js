import AppError from '../libs/error/AppError.js';

export default ({ cortex }) => ({
    errorHandler: (err, req, res, next) => {
        // Log error details
        cortex.publish('error:occurred', {
            error: {
                code: err.code || 'INTERNAL_ERROR',
                message: err.message,
                stack: err.stack,
                details: err.details || null
            },
            request: {
                path: req.path,
                method: req.method,
                query: req.query,
                body: req.body,
                user: req.user ? { 
                    id: req.user.id,
                    role: req.user.role 
                } : null
            },
            timestamp: new Date()
        });

        // Handle Joi validation errors
        if (err.isJoi) {
            return res.status(400).json({
                ok: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Validation error',
                    details: err.details.map(d => ({
                        field: d.path.join('.'),
                        message: d.message
                    }))
                }
            });
        }

        // Handle MongoDB/Mongoose errors
        if (err.name === 'MongoError' || err.name === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Database operation failed',
                    details: err.message
                }
            });
        }

        // Handle custom AppErrors
        if (err instanceof AppError) {
            return res.status(err.status).json({
                ok: false,
                error: err.toJSON()
            });
        }

        // Handle unknown errors
        console.error('Unhandled error:', err);
        res.status(500).json({
            ok: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                timestamp: new Date()
            }
        });
    }
});