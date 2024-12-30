import errorCodes from './codes.js';

class AppError extends Error {
    constructor(errorCode, details = null) {
        const error = errorCodes[errorCode];
        super(error.message);
        console.log(details)
        this.name = 'AppError';
        this.code = error.code;
        this.status = error.status;
        this.details = details;
        this.timestamp = new Date();

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

export default AppError;