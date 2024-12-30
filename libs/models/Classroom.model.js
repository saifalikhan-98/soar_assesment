import { Schema, model } from 'mongoose';

const classroomSchema = new Schema({
    schoolId: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    currentStudents: {
        type: Number,
        default: 0,
        min: 0
    },
    resources: [{
        type: String,
        enum: ['Projector', 'Whiteboard', 'Computers', 'Lab Equipment']
    }],
    status: {
        type: String,
        enum: ['active', 'maintenance', 'inactive', 'deleted'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    deletedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index for school and classroom name uniqueness
classroomSchema.index({ schoolId: 1, name: 1 }, { unique: true });

// Virtual for students in this classroom
classroomSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'classroomId'
});

// Pre-save middleware for capacity validation
classroomSchema.pre('save', async function(next) {
    if (this.isModified('capacity') && this.currentStudents > this.capacity) {
        next(new Error('Capacity cannot be less than current students'));
    }
    this.updatedAt = new Date();
    next();
});

export default model('Classroom', classroomSchema);
