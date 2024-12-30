import request from 'supertest';
import { getTestApp } from '../../utils/testApp.js';
import { 
    setupTestDB, 
    getAuthToken, 
    clearCollections,
    mockSchool,
    mockUsers 
} from '../../setup.js';
import { jest } from '@jest/globals';


jest.setTimeout(30000);

describe('School Authorization', () => {
    let app;
    let mongoClient;
    let db;
    let adminToken;
    let schoolAdminToken;
    let testSchool;

    beforeAll(async () => {
        try {
            // Initialize app and database
            app = await getTestApp();
            const testDb = await setupTestDB();
            mongoClient = testDb.client;
            db = testDb.db;
            
            // Get admin token
            adminToken = await getAuthToken(request, app);

            // Create school admin user
            await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'schooladmin@test.com',
                    password: 'SchoolAdmin123!',
                    role: 'school_admin'
                });

            // Get school admin token
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'schooladmin@test.com',
                    password: 'SchoolAdmin123!'
                });

            schoolAdminToken = loginResponse.body.token;
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
            
            // Recreate admin user and get new token
            adminToken = await getAuthToken(request, app);

            // Create school admin user again after cleanup
            const schoolAdminResponse = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(mockUsers.schoolAdmin);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: mockUsers.schoolAdmin.email,
                    password: mockUsers.schoolAdmin.password
                });

            schoolAdminToken = loginResponse.body.token;
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 10000);

    describe('Authentication Requirements', () => {
        const routes = [
            { method: 'get', path: '/api/schools' },
            { method: 'post', path: '/api/schools' },
            { method: 'get', path: '/api/schools/507f1f77bcf86cd799439011' },
            { method: 'patch', path: '/api/schools/507f1f77bcf86cd799439011' },
            { method: 'delete', path: '/api/schools/507f1f77bcf86cd799439011' },
            { method: 'get', path: '/api/schools/507f1f77bcf86cd799439011/stats' }
        ];

        test.each(routes)('should require authentication for $method $path', async (route) => {
            const response = await request(app)[route.method](route.path);
            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('UNAUTHORIZED');
        }, 10000);
    });

    describe('Role-based Access Control', () => {
        test('should restrict school creation to super admins', async () => {
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${schoolAdminToken}`)
                .send(mockSchool);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('FORBIDDEN');
        }, 10000);

        test('should allow school admins to view their assigned school', async () => {
            // Create a school with super admin
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(mockSchool);

            const schoolId = schoolResponse.body.school._id;

            // Assign school to the school admin
            await request(app)
                .patch('/api/users/school-assignment')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    schoolId,
                    userId: 'school-admin-user-id' // This should match your actual user ID
                });

            // Attempt to view the assigned school
            const response = await request(app)
                .get(`/api/schools/${schoolId}`)
                .set('Authorization', `Bearer ${schoolAdminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.school._id).toBe(schoolId);
        }, 10000);

        test('should prevent school admins from viewing unassigned schools', async () => {
            // Create two schools
            const [school1Response, school2Response] = await Promise.all([
                request(app)
                    .post('/api/schools')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(mockSchool),
                request(app)
                    .post('/api/schools')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        ...mockSchool,
                        name: "Another Test School",
                        contactInfo: {
                            ...mockSchool.contactInfo,
                            email: "another@test.com"
                        }
                    })
            ]);

            // Assign first school to school admin
            await request(app)
                .patch('/api/users/school-assignment')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    schoolId: school1Response.body.school._id,
                    userId: 'school-admin-user-id'
                });

            // Attempt to view the unassigned school
            const response = await request(app)
                .get(`/api/schools/${school2Response.body.school._id}`)
                .set('Authorization', `Bearer ${schoolAdminToken}`);

            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('FORBIDDEN');
        }, 10000);

        test('should allow super admin to view all schools', async () => {
            // Create multiple schools
            await Promise.all([
                request(app)
                    .post('/api/schools')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(mockSchool),
                request(app)
                    .post('/api/schools')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        ...mockSchool,
                        name: "Second School",
                        contactInfo: {
                            ...mockSchool.contactInfo,
                            email: "second@test.com"
                        }
                    })
            ]);

            const response = await request(app)
                .get('/api/schools')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.schools)).toBe(true);
            expect(response.body.schools.length).toBe(2);
        }, 10000);
    });

    describe('School Admin Operations', () => {
        let assignedSchool;

        beforeEach(async () => {
            // Create and assign a school to the school admin
            const schoolResponse = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(mockSchool);

            assignedSchool = schoolResponse.body.school;

            await request(app)
                .patch('/api/users/school-assignment')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    schoolId: assignedSchool._id,
                    userId: 'school-admin-user-id'
                });
        }, 10000);

        test('should allow school admin to update their school', async () => {
            const updates = {
                name: "Updated School Name",
                contactInfo: {
                    email: "updated@school.com",
                    phone: "+1987654321"
                }
            };

            const response = await request(app)
                .patch(`/api/schools/${assignedSchool._id}`)
                .set('Authorization', `Bearer ${schoolAdminToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.school.name).toBe(updates.name);
        }, 10000);

        test('should allow school admin to view school statistics', async () => {
            const response = await request(app)
                .get(`/api/schools/${assignedSchool._id}/stats`)
                .set('Authorization', `Bearer ${schoolAdminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('studentStats');
            expect(response.body).toHaveProperty('classroomStats');
        }, 10000);
    });
});