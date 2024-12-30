export const AUTH_REQUIRED = {
    code: 'AUTH_REQUIRED',
    message: 'Authentication is required',
    status: 401
};
export const INVALID_TOKEN = {
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token',
    status: 401
};
export const ACCESS_DENIED = {
    code: 'ACCESS_DENIED',
    message: 'You do not have permission to perform this action',
    status: 403
};
export const RESOURCE_NOT_FOUND = {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Requested resource not found',
    status: 404
};
export const RESOURCE_EXISTS = {
    code: 'RESOURCE_EXISTS',
    message: 'Resource already exists',
    status: 409
};
export const INVALID_INPUT = {
    code: 'INVALID_INPUT',
    message: 'Invalid input data',
    status: 400
};
export const CLASSROOM_FULL = {
    code: 'CLASSROOM_FULL',
    message: 'Classroom has reached maximum capacity',
    status: 422
};
export const INVALID_TRANSFER = {
    code: 'INVALID_TRANSFER',
    message: 'Student transfer request is invalid',
    status: 422
};
export const SCHOOL_INACTIVE = {
    code: 'SCHOOL_INACTIVE',
    message: 'School is not active',
    status: 422
};
export const INTERNAL_ERROR = {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error occurred',
    status: 500
};
export const DATABASE_ERROR = {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    status: 500
};
export const EXTERNAL_SERVICE_ERROR = {
    code: 'EXTERNAL_SERVICE_ERROR',
    message: 'External service request failed',
    status: 503
};

export default {
    AUTH_REQUIRED,
    INVALID_TOKEN,
    ACCESS_DENIED,
    RESOURCE_NOT_FOUND,
    RESOURCE_EXISTS,
    INVALID_INPUT,
    CLASSROOM_FULL,
    INVALID_TRANSFER,
    SCHOOL_INACTIVE,
    INTERNAL_ERROR,
    DATABASE_ERROR,
    EXTERNAL_SERVICE_ERROR
};