import request from 'supertest';
import { getTestApp } from '../../utils/testApp.js';
import { 
    setupTestDB, 
    getAuthToken, 
    clearCollections,
    mockSchool,
    mockClassroom,
    mockStudent 
} from '../../setup.js';
import { jest } from '@jest/globals';


jest.setTimeout(30000);

describe('Classroom CRUD Operations', () => {
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
            
            // Get auth token
            authToken = await getAuthToken(request, app);

            // Create test school
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);
            
            testSchool = schoolResponse.body.school;
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
            
            // Recreate test school after cleanup
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);
            
            testSchool = schoolResponse.body.school;
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 10000);

    describe('Classroom Creation', () => {
        test('should create a classroom with valid data', async () => {
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);

            expect(response.status).toBe(201);
            expect(response.body.classroom).toHaveProperty('_id');
            expect(response.body.classroom.name).toBe(mockClassroom.name);
            expect(response.body.classroom.schoolId).toBe(testSchool._id);
        }, 10000);

        test('should validate capacity limits', async () => {
            const invalidClassroom = {
                ...mockClassroom,
                capacity: 101 // Exceeds maximum capacity
            };

            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidClassroom);

            expect(response.status).toBe(400);
            expect(response.body.error.details).toContain('capacity');
        }, 10000);

        test('should validate resource types', async () => {
            const invalidClassroom = {
                ...mockClassroom,
                resources: ['InvalidResource']
            };

            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidClassroom);

            expect(response.status).toBe(400);
            expect(response.body.error.details).toContain('resources');
        }, 10000);
    });

    describe('Classroom Retrieval', () => {
        let testClassroom;

        beforeEach(async () => {
            // Create test classroom
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);

            testClassroom = response.body.classroom;
        }, 10000);

        test('should get classroom by ID', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/classrooms/${testClassroom._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.classroom._id).toBe(testClassroom._id);
        }, 10000);

        test('should list classrooms with filters', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/classrooms`)
                .query({ 
                    status: 'active',
                    hasResource: 'Projector',
                    page: 1,
                    limit: 10
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.classrooms)).toBe(true);
        }, 10000);
    });

    describe('Classroom Updates', () => {
        let testClassroom;

        beforeEach(async () => {
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);

            testClassroom = response.body.classroom;
        }, 10000);

        test('should update classroom information', async () => {
            const updates = {
                name: "Updated Classroom",
                capacity: 25,
                resources: ["Smart Board", "Audio System"]
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}/classrooms/${testClassroom._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.classroom.name).toBe(updates.name);
            expect(response.body.classroom.capacity).toBe(updates.capacity);
            expect(response.body.classroom.resources).toEqual(expect.arrayContaining(updates.resources));
        }, 10000);

        test('should handle maintenance status update', async () => {
            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}/classrooms/${testClassroom._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'maintenance' });

            expect(response.status).toBe(200);
            expect(response.body.classroom.status).toBe('maintenance');
        }, 10000);
    });

    describe('Classroom Deletion', () => {
        let testClassroom;

        beforeEach(async () => {
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);

            testClassroom = response.body.classroom;
        }, 10000);

        test('should soft delete classroom', async () => {
            const response = await request(app)
                .delete(`/api/schools/${testSchool._id}/classrooms/${testClassroom._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.classroom.status).toBe('inactive');
        }, 10000);

        test('should handle active students during deletion', async () => {
            // Create a student in the classroom
            await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...mockStudent,
                    classroomId: testClassroom._id
                });

            const response = await request(app)
                .delete(`/api/schools/${testSchool._id}/classrooms/${testClassroom._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('ACTIVE_STUDENTS');
        }, 10000);
    });
});