export default ({ config }) => {
    return {
        validateBody: (schema) => async (req, res, next) => {
            try {
                const validated = await schema.validateAsync(req.body, {
                    abortEarly: false,
                    stripUnknown: true
                });
                req.validatedBody = validated;
                next();
            } catch (error) {
                console.log(error);
                const errors = error.details?.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                })) || [{
                    field: 'body',
                    message: 'Invalid request body'
                }];
                
                res.status(400).json({
                    ok: false,
                    errors,
                    message: 'Validation failed'
                });
            }
        },

        validateQuery: (schema) => async (req, res, next) => {
            try {
                const validated = await schema.validateAsync(req.query, {
                    abortEarly: false,
                    stripUnknown: true
                });
                req.validatedQuery = validated;
                next();
            } catch (error) {
                const errors = error.details?.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                })) || [{
                    field: 'query',
                    message: 'Invalid query parameters'
                }];

                res.status(400).json({
                    ok: false,
                    errors,
                    message: 'Query validation failed'
                });
            }
        },

        validateParams: (schema) => async (req, res, next) => {
            try {
                const validated = await schema.validateAsync(req.params, {
                    abortEarly: false,
                    stripUnknown: true
                });
                req.validatedParams = validated;
                next();
            } catch (error) {
                console.log('Validation error:', error);
                
                const errors = error.details?.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                })) || [{
                    field: 'params',
                    message: 'Invalid path parameters'
                }];

                res.status(400).json({
                    ok: false,
                    errors,
                    message: 'Path parameters validation failed'
                });
            }
        }
    };
};