import { Schema, model } from 'mongoose';

const transferHistorySchema = new Schema({
    fromSchool: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: [true, 'Previous school is required']
    },
    toSchool: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: [true, 'New school is required']
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    reason: {
        type: String,
        trim: true,
        maxlength: [500, 'Transfer reason cannot exceed 500 characters']
    }
});

const studentSchema = new Schema({
    schoolId: {
        type: Schema.Types.ObjectId,
        ref: 'School',
        required: [true, 'School ID is required'],
        index: true
    },
    classroomId: {
        type: Schema.Types.ObjectId,
        ref: 'Classroom',
        index: true
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters'],
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters'],
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    grade: {
        type: Number,
        required: [true, 'Grade is required'],
        min: [1, 'Grade must be between 1 and 12'],
        max: [12, 'Grade must be between 1 and 12']
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'inactive', 'transferred', 'graduated', 'deleted'],
            message: '{VALUE} is not a valid status'
        },
        default: 'active',
        index: true
    },
    transferHistory: [transferHistorySchema],
    enrolledAt: {
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

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Compound indexes for performance
studentSchema.index({ schoolId: 1, status: 1 });
studentSchema.index({ email: 1 }, { unique: true });
studentSchema.index({ lastName: 1, firstName: 1 });

// Save the old classroom ID before updating
studentSchema.pre('save', function(next) {
    if (this.isModified('classroomId')) {
        this._oldClassroomId = this._original ? this._original.classroomId : undefined;
    }
    next();
});

// Update classroom count on student save/update
studentSchema.pre('save', async function(next) {
    try {
        if (this.isModified('classroomId')) {
            const Classroom = model('Classroom');
            const oldClassroomId = this._oldClassroomId;
            
            // Decrement old classroom count
            if (oldClassroomId) {
                await Classroom.updateOne(
                    { _id: oldClassroomId },
                    { $inc: { currentStudents: -1 }}
                );
            }
            
            // Increment new classroom count
            if (this.classroomId) {
                const classroom = await Classroom.findById(this.classroomId);
                if (!classroom) {
                    throw new Error('Classroom not found');
                }
                if (classroom.currentStudents >= classroom.capacity) {
                    throw new Error('Classroom is at full capacity');
                }
                await classroom.updateOne({ $inc: { currentStudents: 1 }});
            }
        }
        this.updatedAt = new Date();
        next();
    } catch (error) {
        next(error);
    }
});

// Method to transfer student to another school
studentSchema.methods.transferToSchool = async function(newSchoolId, reason) {
    const oldSchoolId = this.schoolId;
    this.schoolId = newSchoolId;
    this.status = 'transferred';
    this.classroomId = null;
    
    this.transferHistory.push({
        fromSchool: oldSchoolId,
        toSchool: newSchoolId,
        date: new Date(),
        reason: reason
    });
    
    return this.save();
};

// Method to soft delete a student
studentSchema.methods.softDelete = function() {
    this.status = 'deleted';
    this.deletedAt = new Date();
    return this.save();
};

// Static method to find active students
studentSchema.statics.findActive = function(schoolId) {
    return this.find({
        schoolId,
        status: 'active'
    }).sort({ lastName: 1, firstName: 1 });
};

// Static method to find students by grade
studentSchema.statics.findByGrade = function(schoolId, grade) {
    return this.find({
        schoolId,
        grade,
        status: { $ne: 'deleted' }
    }).sort({ lastName: 1, firstName: 1 });
};

const Student = model('Student', studentSchema);

export default Student;