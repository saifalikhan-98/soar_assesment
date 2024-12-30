import AppError from '../../libs/error/AppError.js';
import BaseManager from '../_common/Base.manager.js';
import { toObjectId } from '../../libs/utils.js';
import { measureMemory } from 'vm';

class StudentManager extends BaseManager {
    constructor(deps) {
        super(deps);
        this.mongo = deps.mongo;
        this.studentExposed = [
            'enrollStudent',    
            'getStudents',      
            'getStudent',       
            'updateStudent',    
            'transferStudent',  
            'deactivateStudent' 
        ];
    }

    async enrollStudent({ schoolId, classroomId, firstName, lastName, email, grade }) {
        try {
            const studentsCollection = this.mongo.collection('students');
            const classroomsCollection = this.mongo.collection('classrooms');

            // Check for existing student
            const existingStudent = await studentsCollection.findOne({ 
                email, 
                status: 'active' 
            });

            if (existingStudent) {
                throw new AppError('RESOURCE_EXISTS', {
                    resource: 'Student',
                    field: 'email',
                    value: email,
                    message: "Student with this email already exists"
                });
            }

            // If classroom specified, check capacity
            if (classroomId) {
                const classroom = await classroomsCollection.findOne({ 
                    _id: toObjectId(classroomId), 
                    schoolId 
                });

                if (!classroom) {
                    throw new AppError('RESOURCE_NOT_FOUND', {
                        resource: 'Classroom',
                        id: classroomId
                    });
                }

                if (classroom.currentStudents >= classroom.capacity) {
                    throw new AppError('CLASSROOM_FULL', {
                        classroomId,
                        currentCapacity: classroom.currentStudents,
                        maxCapacity: classroom.capacity
                    });
                }
            }

            // Create student
            const result = await studentsCollection.insertOne({
                schoolId,
                classroomId,
                firstName,
                lastName,
                email,
                grade,
                status: 'active',
                enrolledAt: new Date(),
                updatedAt: new Date()
            });

            const student = await studentsCollection.findOne({ _id: result.insertedId });

            // Update classroom count if assigned
            if (classroomId) {
                await classroomsCollection.findOneAndUpdate(
                    { _id: toObjectId(classroomId) },
                    { $inc: { currentStudents: 1 }},
                    { returnDocument: 'after' }
                );
            }

            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('student:enrolled', {
                    studentId: student._id,
                    schoolId,
                    classroomId
                });
            }

            return { student };
        } catch (error) {
            console.log(error)
            throw new AppError('DATABASE_ERROR', {
                operation: 'enrollStudent',
                details: error.message
            });
        }
    }

    async getStudents({ schoolId, classroomId, page = 1, limit = 10 }) {
        try {
            const studentsCollection = this.mongo.collection('students');

            const query = {
                schoolId,
                status: 'active',
                ...(classroomId && { classroomId })
            };

            const [students, total] = await Promise.all([
                studentsCollection.find(query)
                    .skip((parseInt(page) - 1) * parseInt(limit))
                    .limit(parseInt(limit))
                    .sort({ enrolledAt: -1 })
                    .toArray(),
                studentsCollection.countDocuments(query)
            ]);

            return {
                students,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            };
        } catch (error) {
            throw new AppError('DATABASE_ERROR', {
                operation: 'getStudents',
                details: error.message
            });
        }
    }

    async getStudent({ studentId, schoolId }) {
        try {
            const studentsCollection = this.mongo.collection('students');

            const student = await studentsCollection.findOne({ 
                _id: toObjectId(studentId),
                schoolId,
                status: 'active'
            });

            if (!student) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Student',
                    id: studentId
                });
            }

            return { student };
        } catch (error) {
            throw new AppError('DATABASE_ERROR', {
                operation: 'getStudent',
                details: error.message
            });
        }
    }

    async updateStudent({ studentId, schoolId, updates }) {
        try {
            const studentsCollection = this.mongo.collection('students');
            const classroomsCollection = this.mongo.collection('classrooms');
            console.log(updates);
            const allowedUpdates = ['firstName', 'lastName', 'grade', 'classroomId'];
            const filteredUpdates = Object.keys(updates)
                .filter(key => allowedUpdates.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updates[key];
                    return obj;
                }, {});
            console.log(filteredUpdates);
            console.log("student", studentId, "school", schoolId)
            if (Object.keys(filteredUpdates).length === 0) {
                throw new AppError('INVALID_INPUT', {
                    message: 'No valid update fields provided',
                    allowedFields: allowedUpdates
                });
            }
            console.log(filteredUpdates.classroomId, schoolId);
            // If changing classroom, verify capacity
            if (filteredUpdates.classroomId) {
                const classroom = await classroomsCollection.findOne({ 
                    _id: toObjectId(filteredUpdates.classroomId),
                    schoolId:schoolId
                });
                console.log(classroom)
                if (!classroom) {
                    throw new AppError('RESOURCE_NOT_FOUND', {
                        resource: 'Classroom',
                        id: filteredUpdates.classroomId,
                        message: 'Classroom not found'
                    });
                }

                if (classroom.currentStudents >= classroom.capacity) {
                    throw new AppError('CLASSROOM_FULL', {
                        classroomId: filteredUpdates.classroomId,
                        currentCapacity: classroom.currentStudents,
                        maxCapacity: classroom.capacity
                    });
                }
            }
            
            const result = await studentsCollection.findOneAndUpdate(
                { _id: toObjectId(studentId), schoolId:schoolId },
                { 
                    $set: {
                        ...filteredUpdates,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );
            console.log("result",result)
            if (!result) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Student',
                    id: studentId
                });
            }

            // Update classroom counts if classroom changed
            if (filteredUpdates.classroomId && result.classroomId !== filteredUpdates.classroomId) {
                await Promise.all([
                    result.classroomId && classroomsCollection.findOneAndUpdate(
                        { _id: toObjectId(result.classroomId) },
                        { $inc: { currentStudents: -1 }},
                        { returnDocument: 'after' }
                    ),
                    classroomsCollection.findOneAndUpdate(
                        { _id: toObjectId(filteredUpdates.classroomId) },
                        { $inc: { currentStudents: 1 }},
                        { returnDocument: 'after' }
                    )
                ]);
            }

            if (this.cortex?.publish) {
                this.cortex.publish('student:updated', {
                    studentId,
                    schoolId,
                    updates: filteredUpdates
                });
            }

            return { student: result };
        } catch (error) {
            console.log("error",error.message.message)
            throw new AppError('DATABASE_ERROR', {
                operation: 'updateStudent',
                details: error.message
            });
        }
    }

    async transferStudent({ studentId, fromSchoolId, toSchoolId, reason }) {
        try {
            console.log(studentId, toSchoolId, fromSchoolId,reason)
            const studentsCollection = this.mongo.collection('students');
            const schoolsCollection = this.mongo.collection('schools');
            const classroomsCollection = this.mongo.collection('classrooms');

            // Verify student exists in current school
            const student = await studentsCollection.findOne({ 
                _id: toObjectId(studentId),
                schoolId: fromSchoolId,
                status: 'active'
            });

            if (!student) {
                throw new AppError('INVALID_TRANSFER', {
                    reason: 'Student not found in source school',
                    studentId,
                    fromSchoolId
                });
            }

            // Verify target school exists and is active
            const targetSchool = await schoolsCollection.findOne({ 
                _id: toObjectId(toSchoolId), 
                status: 'active' 
            });
            console.log('target',targetSchool, toSchoolId);
            if (!targetSchool) {
                throw new AppError('SCHOOL_INACTIVE', {
                    schoolId: toSchoolId
                });
            }

            const result = await studentsCollection.findOneAndUpdate(
                { _id: toObjectId(studentId) },
                { 
                    $set: {
                        schoolId: toSchoolId,
                        classroomId: null,
                        lastTransferDate: new Date(),
                        lastTransferReason: reason,
                        updatedAt: new Date()
                    },
                    $push: {
                        transferHistory: {
                            fromSchoolId,
                            toSchoolId,
                            date: new Date(),
                            reason
                        }
                    }
                },
                { returnDocument: 'after' }
            );

            if (!result) {
                throw new AppError('DATABASE_ERROR', {
                    operation: 'transferStudent',
                    details: 'Failed to update student record'
                });
            }

            // Update classroom count if needed
            if (student.classroomId) {
                await classroomsCollection.findOneAndUpdate(
                    { _id: student.classroomId },
                    { $inc: { currentStudents: -1 }},
                    { returnDocument: 'after' }
                );
            }

            if (this.cortex?.publish) {
                this.cortex.publish('student:transferred', {
                    studentId,
                    fromSchoolId,
                    toSchoolId,
                    reason
                });
            }

            return { student: result };
        } catch (error) {
            console.log("err",error)
            throw new AppError('DATABASE_ERROR', {
                operation: 'transferStudent',
                details: error.message
            });
        }
    }

    async deactivateStudent({ studentId, schoolId, reason }) {
        try {
            const studentsCollection = this.mongo.collection('students');
            const classroomsCollection = this.mongo.collection('classrooms');

            const student = await studentsCollection.findOne({ 
                _id: toObjectId(studentId),
                schoolId,
                status: 'active'
            });
            
            if (!student) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Student',
                    id: studentId
                });
            }

            const result = await studentsCollection.findOneAndUpdate(
                { _id: toObjectId(studentId) },
                { 
                    $set: {
                        status: 'inactive',
                        deactivationReason: reason,
                        deactivatedAt: new Date(),
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            // Update classroom count if needed
            if (student.classroomId) {
                await classroomsCollection.findOneAndUpdate(
                    { _id: toObjectId(student.classroomId) },
                    { $inc: { currentStudents: -1 }},
                    { returnDocument: 'after' }
                );
            }

            if (this.cortex?.publish) {
                this.cortex.publish('student:deactivated', {
                    studentId,
                    schoolId,
                    reason
                });
            }

            return { success: true };
        } catch (error) {
            console.log("error",error)
            throw new AppError('DATABASE_ERROR', {
                operation: 'deactivateStudent',
                details: error.message
            });
        }
    }
}

export default StudentManager;