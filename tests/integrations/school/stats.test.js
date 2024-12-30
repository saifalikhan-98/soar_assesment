import request from 'supertest';
import { getTestApp } from '../../utils/testApp.js';
import { 
    setupTestDB, 
    getAuthToken, 
    clearCollections,
    mockSchool,
    mockStudent,
    mockClassroom 
} from '../../setup.js';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

describe('School Statistics', () => {
    let app;
    let mongoClient;
    let db;
    let authToken;
    let testSchool;

    beforeAll(async () => {
        try {
            app = await getTestApp();
            const testDb = await setupTestDB();
            mongoClient = testDb.client;
            db = testDb.db;
            authToken = await getAuthToken(request, app);
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    }, 30000);

    afterAll(async () => {
        try {
            await clearCollections(db);
            if (mongoClient) {
                await mongoClient.close();
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }, 10000);

    beforeEach(async () => {
        try {
            await clearCollections(db);
            
            // Create test school
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            testSchool = schoolResponse.body.school;

            // Create test students with various states
            await db.collection('students').insertMany([
                {
                    ...mockStudent,
                    schoolId: testSchool._id,
                    status: "active",
                    grade: 10,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    ...mockStudent,
                    firstName: "Jane",
                    lastName: "Smith",
                    email: "jane.smith@test.com",
                    grade: 11,
                    status: "active",
                    schoolId: testSchool._id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    ...mockStudent,
                    firstName: "Bob",
                    lastName: "Brown",
                    email: "bob.brown@test.com",
                    grade: 11,
                    status: "inactive",
                    schoolId: testSchool._id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    ...mockStudent,
                    firstName: "Alice",
                    lastName: "Johnson",
                    email: "alice.johnson@test.com",
                    grade: 12,
                    status: "graduated",
                    schoolId: testSchool._id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);

            // Create test classroom
            await db.collection('classrooms').insertMany([
                {
                    ...mockClassroom,
                    schoolId: testSchool._id,
                    status: 'active',
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    ...mockClassroom,
                    name: "Inactive Classroom",
                    status: 'inactive',
                    schoolId: testSchool._id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]);
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 10000);

    describe('Student Statistics', () => {
        test('should get accurate student count statistics', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('studentStats');
            expect(response.body.studentStats).toMatchObject({
                total: 4,
                active: 2,
                inactive: 1,
                graduated: 1,
                statusBreakdown: {
                    active: 2,
                    inactive: 1,
                    graduated: 1
                }
            });
        }, 10000);

        test('should get accurate grade distribution', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body.studentStats.gradeDistribution).toMatchObject({
                10: 1, // One student in grade 10
                11: 2, // Two students in grade 11
                12: 1  // One student in grade 12
            });
        }, 10000);

        test('should track student status changes in statistics', async () => {
            // Get initial stats
            const initialResponse = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            // Change student status
            const activeStudent = await db.collection('students')
                .findOne({ schoolId: testSchool._id, status: 'active' });

            await request(app)
                .patch(`/api/schools/${testSchool._id}/students/${activeStudent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'inactive' });

            // Get updated stats
            const updatedResponse = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(updatedResponse.body.studentStats.active)
                .toBe(initialResponse.body.studentStats.active - 1);
            expect(updatedResponse.body.studentStats.inactive)
                .toBe(initialResponse.body.studentStats.inactive + 1);
        }, 10000);
    });

    describe('Classroom Statistics', () => {
        test('should get accurate classroom statistics', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body.classroomStats).toMatchObject({
                total: 2,
                active: 1,
                inactive: 1,
                statusBreakdown: {
                    active: 1,
                    inactive: 1
                }
            });
        }, 10000);

        test('should update classroom occupancy stats', async () => {
            // Get active classroom
            const classroom = await db.collection('classrooms')
                .findOne({ schoolId: testSchool._id, status: 'active' });

            // Add students to classroom
            await db.collection('students').updateMany(
                { schoolId: testSchool._id, status: 'active' },
                { $set: { classroomId: classroom._id } }
            );

            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body.classroomStats.occupancyRates).toBeDefined();
            expect(response.body.classroomStats.occupancyRates[classroom._id])
                .toBeDefined();
        }, 10000);
    });

    describe('Error Handling', () => {
        test('should handle non-existent school for stats', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';

            const response = await request(app)
                .get(`/api/schools/${nonExistentId}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
        }, 10000);

        test('should handle invalid school ID format', async () => {
            const invalidId = 'invalid-id';

            const response = await request(app)
                .get(`/api/schools/${invalidId}/stats`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }, 10000);
    });

    describe('Time-based Statistics', () => {
        test('should get enrollment trends over time', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .query({ timeRange: 'year' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body.studentStats).toHaveProperty('enrollmentTrends');
            expect(Array.isArray(response.body.studentStats.enrollmentTrends))
                .toBe(true);
        }, 10000);

        test('should get classroom utilization trends', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/stats`)
                .query({ timeRange: 'month' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.body.classroomStats).toHaveProperty('utilizationTrends');
            expect(Array.isArray(response.body.classroomStats.utilizationTrends))
                .toBe(true);
        }, 10000);
    });
});