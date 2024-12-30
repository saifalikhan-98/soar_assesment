import { Schema, model } from 'mongoose';

const addressSchema = new Schema({
    street: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, 'Street address must be at least 3 characters']
    },
    city: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'City name must be at least 2 characters']
    },
    state: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'State must be at least 2 characters']
    },
    zipCode: {
        type: String,
        required: true,
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    }
});

const contactSchema = new Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        match: [/^\+?1?\d{9,15}$/, 'Please enter a valid phone number']
    }
});

const schoolSchema = new Schema({
    name: {
        type: String,
        required: [true, 'School name is required'],
        trim: true,
        unique: true,
        minlength: [3, 'School name must be at least 3 characters']
    },
    address: {
        type: addressSchema,
        required: true
    },
    contactInfo: {
        type: contactSchema,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active',
        index: true
    },
    adminId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for classrooms
schoolSchema.virtual('classrooms', {
    ref: 'Classroom',
    localField: '_id',
    foreignField: 'schoolId',
    options: { sort: { createdAt: -1 } }
});

// Virtual for students
schoolSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'schoolId',
    options: { sort: { lastName: 1, firstName: 1 } }
});

// Index for faster queries
schoolSchema.index({ name: 1 });
schoolSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
schoolSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Method to soft delete a school
schoolSchema.methods.softDelete = function() {
    this.status = 'deleted';
    this.deletedAt = new Date();
    return this.save();
};

// Static method to find active schools
schoolSchema.statics.findActive = function() {
    return this.find({ status: 'active' });
};

// Static method to find schools by admin
schoolSchema.statics.findByAdmin = function(adminId) {
    return this.find({ adminId, status: { $ne: 'deleted' } });
};

const School = model('School', schoolSchema);

export default School;