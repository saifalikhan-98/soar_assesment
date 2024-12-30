import Joi from 'joi';

// Common validation schemas
const commonSchemas = {
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid ID format - must be a valid MongoDB ObjectId'
        }),
    
    email: Joi.string()
        .email()
        .required()
        .lowercase()
        .trim()
        .messages({
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required'
        }),
    
    phone: Joi.string()
        .pattern(/^\+?[\d\s-]{10,}$/)
        .messages({
            'string.pattern.base': 'Please enter a valid phone number'
        }),
    
    pagination: {
        page: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                'number.min': 'Page number must be greater than 0'
            }),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(10)
            .messages({
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 100 items per page'
            })
    }
};

// Address schema
const addressSchema = Joi.object({
    street: Joi.string()
        .required()
        .trim()
        .min(3)
        .max(100)
        .messages({
            'string.min': 'Street address must be at least 3 characters',
            'string.max': 'Street address cannot exceed 100 characters'
        }),
    city: Joi.string()
        .required()
        .trim()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'City name must be at least 2 characters',
            'string.max': 'City name cannot exceed 50 characters'
        }),
    state: Joi.string()
        .required()
        .trim()
        .length(2)
        .messages({
            'string.length': 'State must be a 2-letter code'
        }),
    zipCode: Joi.string()
        .required()
        .pattern(/^\d{5}(-\d{4})?$/)
        .messages({
            'string.pattern.base': 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'
        })
});

// Contact info schema
const contactInfoSchema = Joi.object({
    email: commonSchemas.email,
    phone: commonSchemas.phone.required()
});

// Resource types enum
const resourceTypes = [
    'Projector',
    'Whiteboard',
    'Computers',
    'Lab Equipment',
    'Smart Board',
    'Audio System',
    'Document Camera'
];

// School validation schemas
const schoolSchemas = {
    create: Joi.object({
        name: Joi.string()
            .required()
            .trim()
            .min(2)
            .max(100)
            .messages({
                'string.min': 'School name must be at least 2 characters',
                'string.max': 'School name cannot exceed 100 characters'
            }),
        address: addressSchema.required(),
        contactInfo: contactInfoSchema.required()
    }),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(100),
        address: addressSchema,
        contactInfo: contactInfoSchema,
        status: Joi.string().valid('active', 'inactive', 'deleted')
    }).min(1).messages({
        'object.min': 'At least one field must be provided for update'
    }),

    getById: Joi.object({
        schoolId: commonSchemas.id.required()
    }),

    list: Joi.object({
        ...commonSchemas.pagination,
        status: Joi.string().valid('active', 'inactive', 'deleted'),
        name: Joi.string().trim(),
        sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt'),
        sortOrder: Joi.string().valid('asc', 'desc')
    }),
    getStats: Joi.object({
        schoolId: commonSchemas.id.required(),
        timeRange: Joi.string().valid('day', 'week', 'month', 'year').default('month')
    }),
    bulkUpdate: Joi.object({
        schools: Joi.array().items(
            Joi.object({
                schoolId: commonSchemas.id.required(),
                updates: Joi.object({
                    name: Joi.string().trim().min(2).max(100),
                    status: Joi.string().valid('active', 'inactive', 'deleted'),
                    address: addressSchema,
                    contactInfo: contactInfoSchema
                }).min(1).required()
            })
        ).min(1).required().messages({
            'array.min': 'At least one school must be provided for bulk update'
        })
    }),
};

// Classroom validation schemas
const classroomSchemas = {
    create: Joi.object({
        name: Joi.string()
            .required()
            .trim()
            .min(2)
            .max(50)
            .messages({
                'string.min': 'Classroom name must be at least 2 characters',
                'string.max': 'Classroom name cannot exceed 50 characters'
            }),
        capacity: Joi.number()
            .integer()
            .required()
            .min(1)
            .max(100)
            .messages({
                'number.min': 'Capacity must be at least 1',
                'number.max': 'Capacity cannot exceed 100 students'
            }),
        resources: Joi.array()
            .items(Joi.string().valid(
                'Projector',
                'Whiteboard',
                'Computers',
                'Lab Equipment',
                'Smart Board',
                'Audio System',
                'Document Camera'
            ))
            .unique()
            .messages({
                'array.unique': 'Duplicate resources are not allowed'
            })
    }),

    update: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .messages({
                'string.min': 'Name must be at least {#limit} characters long',
                'string.max': 'Name cannot exceed {#limit} characters',
                'string.empty': 'Name cannot be empty'
            }),
        capacity: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .messages({
                'number.base': 'Capacity must be a number',
                'number.integer': 'Capacity must be an integer',
                'number.min': 'Capacity must be at least {#limit}',
                'number.max': 'Capacity cannot exceed {#limit}'
            }),
        resources: Joi.array()
            .items(Joi.string().valid(...resourceTypes))
            .unique()
            .messages({
                'array.base': 'Resources must be an array',
                'array.unique': 'Resources must be unique',
                'any.only': 'Invalid resource type provided'
            }),
        status: Joi.string()
            .valid('active', 'maintenance', 'inactive')
            .messages({
                'any.only': 'Status must be one of: active, maintenance, or inactive'
            })
    }).min(1).messages({
        'object.min': 'At least one field must be provided for update'
    }),

    getById: Joi.object({
        classroomId: commonSchemas.id.required(),
        schoolId: commonSchemas.id.required()
    }),

    bulkUpdate: Joi.object({
        updates: Joi.array().items(
            Joi.object({
                classroomId: commonSchemas.id.required(),
                name: Joi.string().trim().min(2).max(50),
                capacity: Joi.number().integer().min(1).max(100),
                resources: Joi.array().items(Joi.string().valid(...resourceTypes)).unique(),
                status: Joi.string().valid('active', 'maintenance', 'inactive')
            }).min(2)
        ).min(1).required()
    }),

    list: Joi.object({
        ...commonSchemas.pagination,
        status: Joi.string()
            .valid('active', 'maintenance', 'inactive'),
        hasResource: Joi.string()
            .valid(...resourceTypes),
        sortBy: Joi.string()
            .valid('name', 'capacity', 'currentStudents', 'status'),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
    })
};

// Student validation schemas
const studentSchemas = {
    enroll: Joi.object({
        schoolId: commonSchemas.id.required(),
        classroomId: commonSchemas.id,
        firstName: Joi.string()
            .required()
            .trim()
            .min(2)
            .max(50)
            .pattern(/^[a-zA-Z\s-']+$/)
            .messages({
                'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes'
            }),
        lastName: Joi.string()
            .required()
            .trim()
            .min(2)
            .max(50)
            .pattern(/^[a-zA-Z\s-']+$/)
            .messages({
                'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
            }),
        email: commonSchemas.email,
        grade: Joi.number()
            .integer()
            .required()
            .min(1)
            .max(12)
            .messages({
                'number.min': 'Grade must be between 1 and 12',
                'number.max': 'Grade must be between 1 and 12'
            })
    }),

    transfer: Joi.object({
        studentId: commonSchemas.id.required(),
        fromSchoolId: commonSchemas.id.required(),
        toSchoolId: commonSchemas.id.required(),
        reason: Joi.string()
            .required()
            .trim()
            .min(10)
            .max(500)
            .messages({
                'string.min': 'Transfer reason must be at least 10 characters',
                'string.max': 'Transfer reason cannot exceed 500 characters'
            })
    }),

    update: Joi.object({
        firstName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z\s-']+$/),
        lastName: Joi.string().trim().min(2).max(50).pattern(/^[a-zA-Z\s-']+$/),
        grade: Joi.number().integer().min(1).max(12),
        classroomId: commonSchemas.id,
        status: Joi.string().valid('active', 'inactive', 'transferred', 'graduated')
    }).min(1),

    list: Joi.object({
        ...commonSchemas.pagination,
        classroomId: commonSchemas.id,
        grade: Joi.number().integer().min(1).max(12),
        status: Joi.string().valid('active', 'inactive', 'transferred', 'graduated'),
        search: Joi.string().trim().min(2).max(50),
        sortBy: Joi.string().valid('lastName', 'firstName', 'grade', 'createdAt'),
        sortOrder: Joi.string().valid('asc', 'desc')
    }),
    
    getById:Joi.object({
        schoolId: commonSchemas.id.required(),
        studentId: commonSchemas.id.required()
    }),

    deactivate: Joi.object({
        reason: Joi.string()
            .required()
            .trim()
            .min(10)
            .max(500)
            .messages({
                'string.min': 'Reason must be at least 10 characters long',
                'string.max': 'Reason cannot exceed 500 characters',
                'any.required': 'Reason is required'
            })
    })
};

const userSchemas = {
    create: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .lowercase()
            .trim()
            .messages({
                'string.email': 'Please enter a valid email address',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .min(8)
            .required()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .messages({
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
                'string.min': 'Password must be at least 8 characters long'
            }),
        role: Joi.string()
            .valid('superadmin', 'school_admin')
            .required(),
        schoolId: Joi.when('role', {
            is: 'school_admin',
            then: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
            otherwise: Joi.forbidden()
        })
    }),

    login: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .lowercase()
            .trim(),
        password: Joi.string()
            .required()
    }),
    assignAdmin: Joi.object({
        userId: commonSchemas.id.required()
            .messages({
                'any.required': 'User ID is required',
                'string.pattern.base': 'Invalid user ID format'
            })
    }),

    // Schema for changing password
    changePassword: Joi.object({
        currentPassword: Joi.string()
            .required()
            .messages({
                'any.required': 'Current password is required'
            }),
        newPassword: Joi.string()
            .min(8)
            .required()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .messages({
                'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
                'string.min': 'New password must be at least 8 characters long',
                'any.required': 'New password is required'
            })
    }),

    // Schema for updating user
    update: Joi.object({
        email: Joi.string()
            .email()
            .lowercase()
            .trim()
            .messages({
                'string.email': 'Please enter a valid email address'
            }),
        status: Joi.string()
            .valid('active', 'inactive')
            .messages({
                'any.only': 'Status must be either active or inactive'
            }),
        schoolId: commonSchemas.id
            .messages({
                'string.pattern.base': 'Invalid school ID format'
            })
    }).min(1).messages({
        'object.min': 'At least one field must be provided for update'
    }),

    // Schema for deactivating user
    deactivate: Joi.object({
        userId: commonSchemas.id.required()
            .messages({
                'any.required': 'User ID is required',
                'string.pattern.base': 'Invalid user ID format'
            })
    }),

    // Schema for getting school admins
    getSchoolAdmins: Joi.object({
        schoolId: commonSchemas.id.required()
            .messages({
                'any.required': 'School ID is required',
                'string.pattern.base': 'Invalid school ID format'
            }),
        ...commonSchemas.pagination
    }),

    // Schema for getting user by ID
    getById: Joi.object({
        userId: commonSchemas.id.required()
            .messages({
                'any.required': 'User ID is required',
                'string.pattern.base': 'Invalid user ID format'
            })
    }),

    // Schema for listing users
    list: Joi.object({
        ...commonSchemas.pagination,
        role: Joi.string()
            .valid('superadmin', 'school_admin'),
        status: Joi.string()
            .valid('active', 'inactive'),
        schoolId: commonSchemas.id,
        search: Joi.string()
            .trim()
            .min(2)
            .max(50),
        sortBy: Joi.string()
            .valid('email', 'role', 'createdAt', 'lastLogin'),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
    })
};

export const schemas = {
    school: schoolSchemas,
    classroom: classroomSchemas,
    student: studentSchemas,
    user: userSchemas
};

export default schemas;