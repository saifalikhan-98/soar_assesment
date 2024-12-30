// managers/response_dispatcher/ResponseDispatcher.manager.js
export default class ResponseDispatcher {
    constructor() {
        this.key = "responseDispatcher";
    }

    /**
     * Standardize API responses
     * @param {Object} res - Express response object
     * @param {Object} options - Response options
     * @param {boolean} options.ok - Success status
     * @param {Object} options.data - Response data
     * @param {Array} options.errors - Error messages
     * @param {number} options.code - HTTP status code
     * @param {string} options.message - Response message
     */
    dispatch(res, { ok = false, data = {}, errors = [], code = 200, message = '' }) {
        const statusCode = code || (ok ? 200 : 400);
        
        return res.status(statusCode).json({
            ok,
            data,
            errors: Array.isArray(errors) ? errors : [errors],
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {Object} data - Response data
     * @param {string} message - Success message
     */
    success(res, data = {}, message = '') {
        return this.dispatch(res, {
            ok: true,
            data,
            message,
            code: 200
        });
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {Array|string} errors - Error messages
     * @param {number} code - HTTP status code
     */
    error(res, errors = [], code = 400) {
        return this.dispatch(res, {
            ok: false,
            errors,
            code
        });
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Array} errors - Validation errors
     */
    validationError(res, errors) {
        return this.dispatch(res, {
            ok: false,
            errors,
            code: 422,
            message: 'Validation failed'
        });
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {string} resource - Resource type
     * @param {string} id - Resource identifier
     */
    notFound(res, resource, id) {
        return this.dispatch(res, {
            ok: false,
            errors: [`${resource} with id ${id} not found`],
            code: 404,
            message: 'Resource not found'
        });
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    unauthorized(res, message = 'Unauthorized access') {
        return this.dispatch(res, {
            ok: false,
            errors: [message],
            code: 401,
            message
        });
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    forbidden(res, message = 'Access forbidden') {
        return this.dispatch(res, {
            ok: false,
            errors: [message],
            code: 403,
            message
        });
    }
}