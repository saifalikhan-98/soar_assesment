import AppError from '../../libs/error/AppError.js';
import BaseManager from '../_common/Base.manager.js';
import { toObjectId } from '../../libs/utils.js';

class ClassroomManager extends BaseManager {
    constructor(deps) {
        super(deps);
        this.mongo = deps.mongo;
        this.classroomExposed = [
            'createClassroom',    
            'getClassrooms',      
            'getClassroom',       
            'updateClassroom',    
            'deleteClassroom'     
        ];
    }

    async createClassroom({ schoolId, name, capacity, resources }) {
        try {
            const schoolsCollection = this.mongo.collection('schools');
            const classroomsCollection = this.mongo.collection('classrooms');

            // Verify school exists and is active
            const school = await schoolsCollection.findOne({ 
                _id: toObjectId(schoolId), 
                status: 'active' 
            });

            if (!school) {
                throw new AppError('SCHOOL_INACTIVE', {
                    schoolId,
                    message: 'School not found or inactive'
                });
            }

            // Check for duplicate classroom name in the same school
            const existingClassroom = await classroomsCollection.findOne({ 
                schoolId,
                name,
                status: { $ne: 'deleted' }
            });

            if (existingClassroom) {
                throw new AppError('RESOURCE_EXISTS', {
                    resource: 'Classroom',
                    field: 'name',
                    value: name,
                    schoolId
                });
            }

            // Create classroom
            const result = await classroomsCollection.insertOne({
                schoolId,
                name,
                capacity,
                resources,
                currentStudents: 0,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const classroom = await classroomsCollection.findOne({ _id: result.insertedId });

            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('classroom:created', {
                    classroomId: classroom._id,
                    schoolId
                });
            }

            return { classroom };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError('DATABASE_ERROR', {
                operation: 'createClassroom',
                schoolId,
                details: error.message
            });
        }
    }

    async getClassrooms({ schoolId, page = 1, limit = 10 }) {
        try {
            const schoolsCollection = this.mongo.collection('schools');
            const classroomsCollection = this.mongo.collection('classrooms');

            // Verify school exists
            const school = await schoolsCollection.findOne({ _id: toObjectId(schoolId) });

            if (!school) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'School',
                    id: schoolId
                });
            }

            const [classrooms, total] = await Promise.all([
                classroomsCollection.find({ 
                    schoolId, 
                    status: 'active' 
                })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .toArray(),
                classroomsCollection.countDocuments({ 
                    schoolId, 
                    status: 'active' 
                })
            ]);

            return { 
                classrooms,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError('DATABASE_ERROR', {
                operation: 'getClassrooms',
                schoolId,
                details: error.message
            });
        }
    }

    async getClassroom({ classroomId, schoolId }) {
        try {
            const classroomsCollection = this.mongo.collection('classrooms');

            const classroom = await classroomsCollection.findOne({ 
                _id: toObjectId(classroomId),
                schoolId,
                status: 'active'
            });

            if (!classroom) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Classroom',
                    id: classroomId,
                    schoolId
                });
            }

            return { classroom };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError('DATABASE_ERROR', {
                operation: 'getClassroom',
                classroomId,
                schoolId,
                details: error.message
            });
        }
    }

    async updateClassroom({ classroomId, schoolId, updates }) {
        try {
            const classroomsCollection = this.mongo.collection('classrooms');
            const { name, capacity, resources } = updates;
    
            // Get current classroom state
            const currentClassroom = await classroomsCollection.findOne({ 
                _id: toObjectId(classroomId), 
                schoolId:schoolId
            });
    
            if (!currentClassroom) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Classroom',
                    id: classroomId,
                    schoolId
                });
            }
    
            // Validate capacity change
            if (capacity && currentClassroom.currentStudents > capacity) {
                throw new AppError('INVALID_OPERATION', {
                    message: 'New capacity cannot be less than current number of students',
                    currentStudents: currentClassroom.currentStudents,
                    requestedCapacity: capacity
                });
            }
    
            // Check for duplicate name if name is being updated
            if (name && name !== currentClassroom.name) {
                const existingClassroom = await classroomsCollection.findOne({ 
                    schoolId: schoolId,
                    name,
                    _id: { $ne: toObjectId(classroomId) },
                    status: { $ne: 'deleted' }
                });
    
                if (existingClassroom) {
                    throw new AppError('RESOURCE_EXISTS', {
                        resource: 'Classroom',
                        field: 'name',
                        value: name,
                        schoolId
                    });
                }
            }
    
            const updateFields = {
                ...(name && { name }),
                ...(capacity && { capacity }),
                ...(resources && { resources }),
                updatedAt: new Date()
            };
    
            if (Object.keys(updateFields).length === 1 && updateFields.updatedAt) {
                throw new AppError('INVALID_INPUT', {
                    message: 'No valid update fields provided',
                    allowedFields: ['name', 'capacity', 'resources']
                });
            }
    
            const result = await classroomsCollection.findOneAndUpdate(
                { 
                    _id: toObjectId(classroomId), 
                    schoolId: schoolId
                },
                { $set: updateFields },
                { returnDocument: 'after' }
            );
           
            if (!result) {
                throw new AppError('DATABASE_ERROR', {
                    message: 'Failed to update classroom',
                    classroomId,
                    schoolId
                });
            }
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('classroom:updated', {
                    classroomId,
                    schoolId,
                    updates: updateFields
                });
            }
    
            return { classroom: result };
        } catch (error) {
            console.log('error',error)
            if (error instanceof AppError) throw error;
    
            throw new AppError('DATABASE_ERROR', {
                operation: 'updateClassroom',
                classroomId,
                schoolId,
                details: error.message
            });
        }
    }

    async deleteClassroom({ classroomId, schoolId }) {
        try {
            const classroomsCollection = this.mongo.collection('classrooms');

            // Check if classroom has active students
            const classroom = await classroomsCollection.findOne({ 
                _id: toObjectId(classroomId), 
                schoolId 
            });

            if (!classroom) {
                throw new AppError('RESOURCE_NOT_FOUND', {
                    resource: 'Classroom',
                    id: classroomId,
                    schoolId
                });
            }

            if (classroom.currentStudents > 0) {
                throw new AppError('INVALID_OPERATION', {
                    message: 'Cannot delete classroom with active students',
                    classroomId,
                    currentStudents: classroom.currentStudents
                });
            }

            const result = await classroomsCollection.findOneAndUpdate(
                { _id: classroomId, schoolId },
                { 
                    $set: { 
                        status: 'deleted',
                        deletedAt: new Date() 
                    }
                },
                { returnDocument: 'after' }
            );

            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('classroom:deleted', {
                    classroomId,
                    schoolId
                });
            }

            return { success: true };
        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError('DATABASE_ERROR', {
                operation: 'deleteClassroom',
                classroomId,
                schoolId,
                details: error.message
            });
        }
    }
}

export default ClassroomManager;