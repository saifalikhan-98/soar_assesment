import AppError from '../../libs/error/AppError.js';
import { toObjectId } from '../../libs/utils.js';
import BaseManager from '../_common/Base.manager.js';

class SchoolManager extends BaseManager {
    constructor(deps) {
        super(deps);
        this.mongo = deps.mongo;
        this.cache = deps.cache;
        this.schoolExposed = [
            'createSchool',   
            'getSchools',          
            'updateSchool',   
            'deleteSchool',
            'getSchoolStats',  // New method for analytics
            'bulkUpdateSchools', // New method for batch operations
            'validateSchoolExists' // New utility method
        ];

        // Cache configuration
        this.CACHE_TTL = 3600; // 1 hour
        this.CACHE_PREFIX = 'school:';
    }

    // Utility method to validate school existence
    async validateSchoolExists(schoolId, { includeSoftDeleted = false } = {}) {
        const query = {
            _id: toObjectId(schoolId),
            ...(includeSoftDeleted ? {} : { status: { $ne: 'deleted' } })
        };
        
        const school = await this.mongo.collection('schools').findOne(query);
        
        if (!school) {
            throw new AppError('RESOURCE_NOT_FOUND', {
                resource: 'School',
                id: schoolId
            });
        }
        
        return school;
    }

    async createSchool({ name, address, contactInfo, adminId }) {
        try {
            const schoolsCollection = this.mongo.collection('schools');

            // Enhanced validation
            if (!name?.trim()) {
                throw new AppError('VALIDATION_ERROR', {
                    field: 'name',
                    message: 'School name is required'
                });
            }

            // Check for existing school with case-insensitive name
            const existingSchool = await schoolsCollection.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') }
            });

            if (existingSchool) {
                throw new AppError('RESOURCE_EXISTS', {
                    resource: 'School',
                    field: 'name',
                    value: name
                });
            }

            // Validate address
            const requiredAddressFields = ['street', 'city', 'state', 'zipCode'];
            for (const field of requiredAddressFields) {
                if (!address?.[field]) {
                    throw new AppError('VALIDATION_ERROR', {
                        field: `address.${field}`,
                        message: `${field} is required in address`
                    });
                }
            }

            // Validate contact info
            if (!contactInfo?.email || !contactInfo?.phone) {
                throw new AppError('VALIDATION_ERROR', {
                    field: 'contactInfo',
                    message: 'Email and phone are required in contact info'
                });
            }

            // Create school with metadata
            const school = {
                name: name.trim(),
                address,
                contactInfo,
                adminId,
                status: 'active',
                metadata: {
                    studentCount: 0,
                    classroomCount: 0,
                    activeTeacherCount: 0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: adminId
            };

            const result = await schoolsCollection.insertOne(school);
            school._id = result.insertedId;

            // Cache the new school
            await this.cacheSchool(school);

            // Emit event with detailed payload
            if (this.cortex?.publish) {
                this.cortex.publish('school:created', { 
                    schoolId: school._id,
                    adminId,
                    schoolName: name,
                    timestamp: new Date()
                });
            }

            return { school };
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError('DATABASE_ERROR', {
                operation: 'createSchool',
                details: error.message
            });
        }
    }

    async getSchools({ 
        page = 1, 
        limit = 10, 
        status = 'active',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        searchTerm = ''
    }) {
        try {
            const schoolsCollection = this.mongo.collection('schools');

            // Build query with search capability
            const query = {
                ...(status && { status }),
                ...(searchTerm && {
                    $or: [
                        { name: { $regex: searchTerm, $options: 'i' } },
                        { 'address.city': { $regex: searchTerm, $options: 'i' } }
                    ]
                })
            };

            // Validate sort parameters
            const allowedSortFields = ['name', 'createdAt', 'studentCount'];
            if (!allowedSortFields.includes(sortBy)) {
                throw new AppError('INVALID_INPUT', {
                    message: 'Invalid sort field',
                    allowedFields: allowedSortFields
                });
            }

            const [schools, total] = await Promise.all([
                schoolsCollection.find(query)
                    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                    .skip((parseInt(page) - 1) * parseInt(limit))
                    .limit(parseInt(limit))
                    .toArray(),
                schoolsCollection.countDocuments(query)
            ]);

            // Add metadata
            const schoolsWithMeta = await Promise.all(schools.map(async school => {
                const [studentCount, classroomCount] = await Promise.all([
                    this.mongo.collection('students').countDocuments({ 
                        schoolId: school._id, 
                        status: 'active' 
                    }),
                    this.mongo.collection('classrooms').countDocuments({ 
                        schoolId: school._id, 
                        status: 'active' 
                    })
                ]);

                return {
                    ...school,
                    metadata: {
                        studentCount,
                        classroomCount
                    }
                };
            }));

            return { 
                schools: schoolsWithMeta,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            };
        } catch (error) {
            throw new AppError('DATABASE_ERROR', {
                operation: 'getSchools',
                details: error.message
            });
        }
    }

    async getSchoolStats({schoolId}) {
        try {
            console.log(schoolId)
            const school = await this.validateSchoolExists(schoolId);
            
            const [
                studentStats,
                classroomStats
            ] = await Promise.all([
                this.getStudentStats(schoolId),
                this.getClassroomStats(schoolId)
            ]);
    
            return {
                schoolInfo: {
                    id: school._id,
                    name: school.name,
                    status: school.status,
                    createdAt: school.createdAt,
                    lastUpdated: school.updatedAt,
                    contactInfo: school.contactInfo,
                    address: school.address
                },
                studentStats,
                classroomStats
            };
        } catch (error) {
            console.log("Database retrieval error", error);
            throw new AppError('DATABASE_ERROR', {
                operation: 'getSchoolStats',
                schoolId,
                details: error.message
            });
        }
    }
    
    // Helper method for student statistics
    async getStudentStats(schoolId) {
        try {
            const studentsCollection = this.mongo.collection('students');
            
            // First, let's check what status values actually exist
            const statusCheck = await studentsCollection.distinct('status', {
                schoolId: toObjectId(schoolId)
            });
            console.log('Available status values:', statusCheck);
    
            const [totalStats, statusDistribution, gradeDistribution] = await Promise.all([
                // Total stats with case-insensitive status check
                studentsCollection.aggregate([
                    { 
                        $match: { 
                            schoolId: schoolId
                        }
                    },
                    { 
                        $group: {
                            _id: null,
                            totalStudents: { $sum: 1 },
                            activeStudents: {
                                $sum: {
                                    $cond: [
                                        { 
                                            $regexMatch: {
                                                input: { $toLower: '$status' },
                                                regex: '^active$'
                                            }
                                        },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]).toArray(),
                
                // Status distribution
                studentsCollection.aggregate([
                    { 
                        $match: { 
                            schoolId: toObjectId(schoolId)
                        }
                    },
                    {
                        $group: {
                            _id: { $toLower: '$status' },
                            count: { $sum: 1 }
                        }
                    }
                ]).toArray(),
                
                // Grade distribution for active students
                studentsCollection.aggregate([
                    { 
                        $match: { 
                            schoolId: toObjectId(schoolId),
                            $expr: {
                                $regexMatch: {
                                    input: { $toLower: '$status' },
                                    regex: '^active$'
                                }
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$grade',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]).toArray()
            ]);
    
            console.log('Total stats result:', totalStats);
            console.log('Status distribution:', statusDistribution);
            console.log('Grade distribution:', gradeDistribution);
    
            const result = {
                total: totalStats[0]?.totalStudents || 0,
                active: totalStats[0]?.activeStudents || 0,
                inactive: (totalStats[0]?.totalStudents || 0) - (totalStats[0]?.activeStudents || 0),
                statusBreakdown: statusDistribution.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                gradeDistribution: gradeDistribution.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {})
            };
    
            console.log('Final result:', result);
            return result;
    
        } catch (error) {
            console.error('Error in getStudentStats:', error);
            throw new AppError('DATABASE_ERROR', {
                operation: 'getStudentStats',
                schoolId,
                details: error.message
            });
        }
    }
    
    // Helper method for classroom statistics
    async getClassroomStats(schoolId) {
        console.log("school id",schoolId)
        const classroomsCollection = this.mongo.collection('classrooms');
    
        
        const [totalStats, statusDistribution] = await Promise.all([
            classroomsCollection.aggregate([
                { $match: { schoolId: schoolId } },
                {
                    $group: {
                        _id: null,
                        totalClassrooms: { $sum: 1 },
                        activeClassrooms: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        }
                    }
                }
            ]).toArray(),
            
            classroomsCollection.aggregate([
                {
                    $match: { schoolId: schoolId }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]).toArray(),
            
            classroomsCollection.aggregate([
                {
                    $match: {
                        schoolId: schoolId,
                        status: 'active'
                    }
                },
                {
                    $group: {
                        _id: '$teacherId',
                        classCount: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        teachersCount: { $sum: 1 },
                        avgClassesPerTeacher: { $avg: '$classCount' },
                        maxClassesPerTeacher: { $max: '$classCount' },
                        minClassesPerTeacher: { $min: '$classCount' }
                    }
                }
            ]).toArray()
        ]);
    
        return {
            total: totalStats[0]?.totalClassrooms || 0,
            active: totalStats[0]?.activeClassrooms || 0,
            inactive: (totalStats[0]?.totalClassrooms || 0) - (totalStats[0]?.activeClassrooms || 0),
            statusBreakdown: statusDistribution.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
            
        };
    }

    async updateSchool(schoolId, updates) {
        try {
            const schoolsCollection = this.mongo.collection('schools');
            
            // Validate school existence
            await this.validateSchoolExists(schoolId);

            // Filter allowed updates
            const allowedUpdates = ['name', 'address', 'contactInfo', 'status'];
            const filteredUpdates = Object.keys(updates)
                .filter(key => allowedUpdates.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updates[key];
                    return obj;
                }, {});

            if (Object.keys(filteredUpdates).length === 0) {
                throw new AppError('INVALID_INPUT', {
                    message: 'No valid update fields provided',
                    allowedFields: allowedUpdates
                });
            }

            // Check name uniqueness if updating name
            if (updates.name) {
                const existingSchool = await schoolsCollection.findOne({
                    name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
                    _id: { $ne: toObjectId(schoolId) }
                });

                if (existingSchool) {
                    throw new AppError('RESOURCE_EXISTS', {
                        resource: 'School',
                        field: 'name',
                        value: updates.name
                    });
                }
            }

            const result = await schoolsCollection.findOneAndUpdate(
                { _id: toObjectId(schoolId) },
                { 
                    $set: {
                        ...filteredUpdates,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );

            // Clear cache
            await this.clearSchoolCache(schoolId);

            // Emit detailed event
            if (this.cortex?.publish) {
                this.cortex.publish('school:updated', {
                    schoolId,
                    updates: filteredUpdates,
                    timestamp: new Date()
                });
            }

            return { school: result};
        } catch (error) {
            throw new AppError('DATABASE_ERROR', {
                operation: 'updateSchool',
                schoolId,
                details: error.message
            });
        }
    }

    // Cache management methods
    async cacheSchool(school) {
        try {
            await this.cache.set(
                `${this.CACHE_PREFIX}${school._id}`,
                school,
                this.CACHE_TTL
            );
        } catch (error) {
            this.cortex?.publish('error:cache', {
                operation: 'set',
                key: `${this.CACHE_PREFIX}${school._id}`,
                error: error.message
            });
        }
    }

    async clearSchoolCache(schoolId) {
        try {
            await this.cache.del(`${this.CACHE_PREFIX}${schoolId}`);
        } catch (error) {
            this.cortex?.publish('error:cache', {
                operation: 'delete',
                key: `${this.CACHE_PREFIX}${schoolId}`,
                error: error.message
            });
        }
    }

    async deleteSchool(schoolId) {
        try {
            const schoolsCollection = this.mongo.collection('schools');
            const studentsCollection = this.mongo.collection('students');
            const classroomsCollection = this.mongo.collection('classrooms');
            
            // Validate school existence
            const school = await this.validateSchoolExists(schoolId, { includeSoftDeleted: false });
            
            // Get initial counts for audit
            const initialCounts = {
                students: await studentsCollection.countDocuments({
                    schoolId: toObjectId(schoolId),
                    status: { $ne: 'deleted' }
                }),
                classrooms: await classroomsCollection.countDocuments({
                    schoolId: toObjectId(schoolId),
                    status: { $ne: 'deleted' }
                })
            };
    
            const timestamp = new Date();
            const deleteMeta = {
                status: 'deleted',
                deletedAt: timestamp,
                updatedAt: timestamp,
                deletedBy: 'SYSTEM',
                deletionReason: 'SCHOOL_DELETE'
            };
    
            // Step 1: Delete students
            const studentResult = await studentsCollection.updateMany(
                { 
                    schoolId: toObjectId(schoolId),
                    status: { $ne: 'deleted' }
                },
                { $set: deleteMeta }
            );
    
            // Step 2: Delete classrooms
            const classroomResult = await classroomsCollection.updateMany(
                {
                    schoolId: toObjectId(schoolId),
                    status: { $ne: 'deleted' }
                },
                { $set: deleteMeta }
            );
    
            // Step 3: Delete the school
            const schoolResult = await schoolsCollection.updateOne(
                { _id: toObjectId(schoolId) },
                { $set: deleteMeta }
            );
    
            if (schoolResult.matchedCount === 0) {
                throw new AppError('DATABASE_ERROR', {
                    message: 'Failed to delete school - school not found',
                    schoolId
                });
            }
    
            if (schoolResult.modifiedCount === 0) {
                throw new AppError('DATABASE_ERROR', {
                    message: 'Failed to delete school - no modifications made',
                    schoolId,
                    details: 'School might already be deleted'
                });
            }
    
            // Fetch the updated school document
            const updatedSchool = await schoolsCollection.findOne({ _id: toObjectId(schoolId) });
    
            // Clear related caches
            await Promise.all([
                this.clearSchoolCache(schoolId),
                this.cache.del(`students:school:${schoolId}`),
                this.cache.del(`classrooms:school:${schoolId}`)
            ]).catch(error => {
                // Log cache clear errors but don't fail the operation
                console.error('Cache clear error:', error);
            });
    
            // Prepare deletion summary
            const deletionSummary = {
                students: {
                    before: initialCounts.students,
                    deleted: studentResult.modifiedCount
                },
                classrooms: {
                    before: initialCounts.classrooms,
                    deleted: classroomResult.modifiedCount
                }
            };
    
            // Emit deletion event
            if (this.cortex?.publish) {
                this.cortex.publish('school:deleted', {
                    schoolId: school._id,
                    schoolName: school.name,
                    timestamp,
                    deletionSummary,
                    metadata: {
                        previousStatus: school.status,
                        deletionOrder: ['students', 'classrooms', 'school']
                    }
                });
            }
    
            return {
                success: true,
                message: 'School and related entities successfully deleted',
                deletionSummary,
                school: updatedSchool
            };
    
        } catch (error) {
            console.error('Delete school error:', error);
            
            if (error instanceof AppError) throw error;
            
            throw new AppError('DATABASE_ERROR', {
                operation: 'deleteSchool',
                schoolId,
                details: error.message
            });
        }
    }
    
    // Add a recovery method to handle partial deletion failures
    async recoverPartialDelete(schoolId) {
        try {
            const collections = {
                schools: this.mongo.collection('schools'),
                students: this.mongo.collection('students'),
                classrooms: this.mongo.collection('classrooms')
            };
    
            // Check current state
            const states = await Promise.all(Object.entries(collections).map(async ([name, collection]) => {
                const query = name === 'schools' 
                    ? { _id: toObjectId(schoolId) }
                    : { schoolId: toObjectId(schoolId) };
                
                const docs = await collection.find(query).toArray();
                return {
                    name,
                    deletedCount: docs.filter(d => d.status === 'deleted').length,
                    totalCount: docs.length
                };
            }));
    
            // Generate recovery report
            return {
                schoolId,
                states,
                partiallyDeleted: states.some(s => s.deletedCount > 0 && s.deletedCount < s.totalCount),
                fullyDeleted: states.every(s => s.deletedCount === s.totalCount),
                recoveryNeeded: states.some(s => s.deletedCount > 0)
            };
        } catch (error) {
            throw new AppError('RECOVERY_CHECK_ERROR', {
                operation: 'recoverPartialDelete',
                schoolId,
                details: error.message
            });
        }
    }
}

export default SchoolManager;