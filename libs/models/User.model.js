import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address'],
        index: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false // Don't include password in queries by default
    },
    role: {
        type: String,
        enum: {
            values: ['superadmin', 'school_admin'],
            message: '{VALUE} is not a valid role'
        },
        required: [true, 'Role is required'],
        index: true
    },
    schoolId: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: function() {
            return this.role === 'school_admin';
        },
        validate: {
            validator: function(value) {
                return this.role !== 'school_admin' || value !== undefined;
            },
            message: 'School ID is required for school administrators'
        },
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'inactive', 'deleted'],
            message: '{VALUE} is not a valid status'
        },
        default: 'active',
        index: true
    },
    lastLogin: {
        type: Date
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    accountLocked: {
        type: Boolean,
        default: false
    },
    lockUntil: {
        type: Date
    },
    passwordChangedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    deletedAt: {
        type: Date,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ role: 1, schoolId: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
    try {
        if (!this.isModified('password')) return next();
        
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        
        if (!this.isNew) {
            this.passwordChangedAt = new Date();
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Method to handle failed login attempt
userSchema.methods.handleFailedLogin = async function() {
    this.failedLoginAttempts += 1;
    
    if (this.failedLoginAttempts >= 5) {
        this.accountLocked = true;
        this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    
    return this.save();
};

// Method to reset failed login attempts
userSchema.methods.resetLoginAttempts = function() {
    this.failedLoginAttempts = 0;
    this.accountLocked = false;
    this.lockUntil = undefined;
    return this.save();
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
    if (!this.accountLocked) return false;
    if (!this.lockUntil) return false;
    
    return new Date() < this.lockUntil;
};

// Method to soft delete user
userSchema.methods.softDelete = function() {
    this.status = 'deleted';
    this.deletedAt = new Date();
    return this.save();
};

// Static method to find active users
userSchema.statics.findActive = function() {
    return this.find({ status: 'active' })
               .select('-password')
               .sort({ createdAt: -1 });
};

// Static method to find school admins
userSchema.statics.findSchoolAdmins = function(schoolId) {
    return this.find({
        role: 'school_admin',
        schoolId,
        status: { $ne: 'deleted' }
    }).select('-password');
};

const User = model('User', userSchema);

export default User;