// tests/integration/student/stats.test.js
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

describe('Student Statistics', () => {
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

            // Create test students with various characteristics
            const students = [
                {
                    ...mockStudent,
                    email: "john@test.com",
                    grade: 9,
                    status: 'active',
                    academicRecord: { gpa: 3.8 }
                },
                {
                    ...mockStudent,
                    firstName: "Jane",
                    lastName: "Smith",
                    email: "jane@test.com",
                    grade: 9,
                    status: 'active',
                    academicRecord: { gpa: 3.9 }
                },
                {
                    ...mockStudent,
                    firstName: "Bob",
                    lastName: "Brown",
                    email: "bob@test.com",
                    grade: 10,
                    status: 'active',
                    academicRecord: { gpa: 3.5 }
                },
                {
                    ...mockStudent,
                    firstName: "Alice",
                    lastName: "Johnson",
                    email: "alice@test.com",
                    grade: 10,
                    status: 'inactive',
                    academicRecord: { gpa: 3.2 }
                },
                {
                    ...mockStudent,
                    firstName: "Charlie",
                    lastName: "Wilson",
                    email: "charlie@test.com",
                    grade: 11,
                    status: 'active',
                    academicRecord: { gpa: 4.0 }
                },
                {
                    ...mockStudent,
                    firstName: "David",
                    lastName: "Lee",
                    email: "david@test.com",
                    grade: 12,
                    status: 'graduated',
                    academicRecord: { gpa: 3.7 }
                }
            ];

            // Insert test students
            await Promise.all(
                students.map(student => 
                    request(app)
                        .post(`/api/schools/${testSchool._id}/students`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(student)
                )
            );

            // Add attendance records
            const createdStudents = await db.collection('students').find().toArray();
            const attendanceRecords = createdStudents.map(student => ({
                studentId: student._id,
                schoolId: testSchool._id,
                records: Array(30).fill().map((_, idx) => ({
                    date: new Date(Date.now() - idx * 24 * 60 * 60 * 1000),
                    status: Math.random() > 0.1 ? 'present' : 'absent',
                    reason: null
                }))
            }));
            await db.collection('attendance').insertMany(attendanceRecords);

            // Add behavioral records
            const behavioralRecords = createdStudents.map(student => ({
                studentId: student._id,
                schoolId: testSchool._id,
                records: [
                    {
                        date: new Date(),
                        type: 'positive',
                        category: 'academic',
                        description: 'Excellent class participation'
                    },
                    {
                        date: new Date(),
                        type: 'negative',
                        category: 'discipline',
                        description: 'Late to class'
                    }
                ]
            }));
            await db.collection('behavioral_records').insertMany(behavioralRecords);

        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 15000);

    describe('Enrollment Statistics', () => {
        test('should get accurate enrollment counts', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/enrollment`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                totalStudents: 6,
                activeStudents: 4,
                inactiveStudents: 1,
                graduatedStudents: 1,
                byGrade: {
                    '9': 2,
                    '10': 2,
                    '11': 1,
                    '12': 1
                }
            });
        }, 10000);

        test('should handle non-existent school ID', async () => {
            const response = await request(app)
                .get(`/api/schools/507f1f77bcf86cd799439011/students/stats/enrollment`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
        }, 10000);
    });

    describe('Academic Performance', () => {
        test('should calculate accurate GPA statistics', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/academic`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                overall: {
                    averageGpa: expect.any(Number),
                    medianGpa: expect.any(Number),
                    highestGpa: 4.0,
                    lowestGpa: 3.2
                },
                byGrade: {
                    '9': { averageGpa: 3.85 },
                    '10': { averageGpa: 3.35 },
                    '11': { averageGpa: 4.0 },
                    '12': { averageGpa: 3.7 }
                }
            });
        }, 10000);

        test('should handle time range queries', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/academic/trends`)
                .query({ 
                    startDate: new Date(Date.now() - 90*24*60*60*1000).toISOString(),
                    endDate: new Date().toISOString()
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.trends).toBeInstanceOf(Array);
            expect(response.body.trends[0]).toMatchObject({
                period: expect.any(String),
                averageGpa: expect.any(Number)
            });
        }, 10000);
    });

    describe('Attendance Tracking', () => {
        test('should calculate accurate attendance rates', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/attendance`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                overall: {
                    attendanceRate: expect.any(Number),
                    presentCount: expect.any(Number),
                    absentCount: expect.any(Number)
                },
                byGrade: expect.any(Object),
                byDay: expect.any(Object)
            });
        }, 10000);

        test('should handle custom date ranges', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/attendance`)
                .query({
                    startDate: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
                    endDate: new Date().toISOString()
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.dateRange).toMatchObject({
                start: expect.any(String),
                end: expect.any(String)
            });
        }, 10000);
    });

    describe('Behavioral Analysis', () => {
        test('should aggregate behavioral incidents', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/behavioral`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                total: {
                    incidents: expect.any(Number),
                    positive: expect.any(Number),
                    negative: expect.any(Number)
                },
                byCategory: expect.any(Object),
                byGrade: expect.any(Object)
            });
        }, 10000);

        test('should calculate incident rates', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/behavioral/rates`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                incidentRate: expect.any(Number),
                positiveRate: expect.any(Number),
                negativeRate: expect.any(Number)
            });
        }, 10000);
    });

    describe('Performance Analytics', () => {
        test('should analyze grade correlations', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/correlations`)
                .query({ factors: ['attendance', 'gpa'] })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                correlationCoefficient: expect.any(Number),
                pValue: expect.any(Number),
                confidenceInterval: {
                    lower: expect.any(Number),
                    upper: expect.any(Number)
                }
            });
        }, 10000);

        test('should generate performance predictions', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}/students/stats/predictions`)
                .query({ 
                    metric: 'academic-performance',
                    timeframe: 'next-quarter'
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.predictions).toBeInstanceOf(Array);
            expect(response.body.predictions[0]).toMatchObject({
                grade: expect.any(Number),
                predictedPerformance: expect.any(Number),
                confidenceLevel: expect.any(Number)
            });
        }, 10000);
    });
});