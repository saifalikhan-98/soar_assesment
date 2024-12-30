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

describe('Student CRUD Operations', () => {
    let app;
    let mongoClient;
    let db;
    let authToken;
    let testSchool;
    let testClassroom;

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

            // Create test classroom
            const classroomResponse = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);
            testClassroom = classroomResponse.body.classroom;
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
            
            // Recreate test school and classroom
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);
            testSchool = schoolResponse.body.school;

            const classroomResponse = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockClassroom);
            testClassroom = classroomResponse.body.classroom;
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 10000);

    describe('Student Creation', () => {
        test('should enroll a student with valid data', async () => {
            const student = {
                ...mockStudent,
                classroomId: testClassroom._id
            };

            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(student);

            expect(response.status).toBe(201);
            expect(response.body.student).toMatchObject({
                firstName: student.firstName,
                lastName: student.lastName,
                email: student.email,
                grade: student.grade,
                status: 'active',
                classroomId: testClassroom._id
            });
            expect(response.body.student._id).toBeDefined();
            expect(response.body.student.createdAt).toBeDefined();
        }, 10000);

        test('should validate required fields', async () => {
            const invalidStudent = {
                firstName: "John"
                // Missing required fields
            };

            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidStudent);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }, 10000);

        // More validation tests...
        test('should prevent duplicate email enrollment', async () => {
            // First enrollment
            await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockStudent);

            // Second enrollment with same email
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockStudent);

            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('RESOURCE_EXISTS');
        }, 10000);

        test('should check classroom capacity', async () => {
            // Fill classroom to capacity
            const enrollments = Array(mockClassroom.capacity).fill().map((_, index) => ({
                ...mockStudent,
                email: `student${index}@test.com`,
                classroomId: testClassroom._id
            }));

            await Promise.all(
                enrollments.map(student => 
                    request(app)
                        .post(`/api/schools/${testSchool._id}/students`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(student)
                )
            );

            // Try to enroll one more student
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...mockStudent,
                    email: "overflow@test.com",
                    classroomId: testClassroom._id
                });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('CLASSROOM_FULL');
        }, 15000);
    });

    describe('Student Retrieval', () => {
        beforeEach(async () => {
            // Create test students
            const students = [
                {
                    ...mockStudent,
                    email: "john@test.com",
                    grade: 9
                },
                {
                    ...mockStudent,
                    firstName: "Jane",
                    lastName: "Smith",
                    email: "jane@test.com",
                    grade: 10
                }
            ];

            await Promise.all(
                students.map(student => 
                    request(app)
                        .post(`/api/schools/${testSchool._id}/students`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(student)
                )
            );
        }, 10000);

        test('should get student by ID', async () => {
            const listResponse = await request(app)
                .get(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`);

            const studentId = listResponse.body.students[0]._id;

            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/${studentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.student._id).toBe(studentId);
        }, 10000);

        test('should list students with filters', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students`)
                .query({ 
                    grade: 9,
                    status: 'active',
                    page: 1,
                    limit: 10
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.students)).toBe(true);
            expect(response.body.students.every(s => s.grade === 9)).toBe(true);
            expect(response.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: expect.any(Number)
            });
        }, 10000);

        test('should search students by name', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students`)
                .query({ search: 'Jane' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.students.some(s => 
                s.firstName === 'Jane' || s.lastName === 'Jane'
            )).toBe(true);
        }, 10000);
    });

    describe('Student Updates', () => {
        let testStudent;

        beforeEach(async () => {
            const response = await request(app)
                .post(`/api/schools/${testSchool._id}/students`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...mockStudent,
                    classroomId: testClassroom._id
                });

            testStudent = response.body.student;
        }, 10000);

        test('should update student information', async () => {
            const updates = {
                firstName: "Updated",
                lastName: "Student",
                grade: 11
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}/students/${testStudent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.student.firstName).toBe(updates.firstName);
            expect(response.body.student.grade).toBe(updates.grade);
            expect(response.body.student.updatedAt).toBeDefined();
        }, 10000);

        test('should validate updates', async () => {
            const invalidUpdates = {
                grade: 13, // Invalid grade
                firstName: "John123" // Invalid name format
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}/students/${testStudent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidUpdates);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }, 10000);

        test('should handle classroom transfer', async () => {
            // Create new classroom
            const newClassroom = await request(app)
                .post(`/api/schools/${testSchool._id}/classrooms`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    ...mockClassroom,
                    name: "New Classroom"
                });

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}/students/${testStudent._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    classroomId: newClassroom.body.classroom._id
                });

            expect(response.status).toBe(200);
            expect(response.body.student.classroomId)
                .toBe(newClassroom.body.classroom._id);
        }, 10000);
    });
});