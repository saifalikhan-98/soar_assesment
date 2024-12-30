import request from 'supertest';
import { getTestApp } from '../../utils/testApp.js';
import { 
    setupTestDB, 
    getAuthToken, 
    clearCollections,
    mockSchool 
} from '../../setup.js';
import { jest } from '@jest/globals';

jest.setTimeout(30000);

describe('School CRUD Operations', () => {
    let app;
    let mongoClient;
    let db;
    let authToken;

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
            // Refresh auth token after collection clear
            authToken = await getAuthToken(request, app);
        } catch (error) {
            console.error('Test setup failed:', error);
            throw error;
        }
    }, 10000);

    describe('School Creation', () => {
        test('should create a school with valid data', async () => {
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            expect(response.status).toBe(201);
            expect(response.body.school).toHaveProperty('_id');
            expect(response.body.school.name).toBe(mockSchool.name);
            expect(response.body.school.status).toBe('active');
        }, 10000);

        test('should reject duplicate school names', async () => {
            // Create first school
            await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            // Attempt to create duplicate
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('RESOURCE_EXISTS');
        }, 10000);

        test('should validate required fields', async () => {
            const invalidSchool = {
                name: "Test School"
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidSchool);

            expect(response.status).toBe(400);
            expect(response.body.error.details).toBeDefined();
        }, 10000);

        test('should validate address format', async () => {
            const invalidSchool = {
                ...mockSchool,
                address: {
                    ...mockSchool.address,
                    state: "Invalid" // Should be 2 letters
                }
            };

            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidSchool);

            expect(response.status).toBe(400);
            expect(response.body.error.details).toContain('state');
        }, 10000);
    });

    describe('School Retrieval', () => {
        let testSchool;

        beforeEach(async () => {
            // Create test school
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            testSchool = response.body.school;
        }, 10000);

        test('should get school by ID', async () => {
            const response = await request(app)
                .get(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.school._id).toBe(testSchool._id);
            expect(response.body.school.name).toBe(testSchool.name);
        }, 10000);

        test('should get schools list with pagination', async () => {
            const response = await request(app)
                .get('/api/schools')
                .query({ 
                    page: 1, 
                    limit: 10,
                    status: 'active'
                })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.schools)).toBe(true);
            expect(response.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: expect.any(Number)
            });
        }, 10000);

        test('should handle non-existent school ID', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';
            const response = await request(app)
                .get(`/api/schools/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
        }, 10000);
    });

    describe('School Updates', () => {
        let testSchool;

        beforeEach(async () => {
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            testSchool = response.body.school;
        }, 10000);

        test('should update school information', async () => {
            const updates = {
                name: "Updated School Name",
                contactInfo: {
                    email: "updated@school.com",
                    phone: "+1987654321"
                }
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.school.name).toBe(updates.name);
            expect(response.body.school.contactInfo.email).toBe(updates.contactInfo.email);
            expect(response.body.school.updatedAt).toBeDefined();
        }, 10000);

        test('should validate update fields', async () => {
            const invalidUpdates = {
                name: "", // Empty name
                status: "invalid_status" // Invalid status
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidUpdates);

            expect(response.status).toBe(400);
            expect(response.body.error.details).toBeDefined();
        }, 10000);

        test('should handle partial updates', async () => {
            const partialUpdate = {
                name: "Partially Updated School"
            };

            const response = await request(app)
                .patch(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(partialUpdate);

            expect(response.status).toBe(200);
            expect(response.body.school.name).toBe(partialUpdate.name);
            expect(response.body.school.contactInfo).toEqual(testSchool.contactInfo);
        }, 10000);
    });

    describe('School Deletion', () => {
        let testSchool;

        beforeEach(async () => {
            const response = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockSchool);

            testSchool = response.body.school;
        }, 10000);

        test('should soft delete school and related entities', async () => {
            const response = await request(app)
                .delete(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.school.status).toBe('deleted');
            expect(response.body.school.deletedAt).toBeDefined();

            // Verify school is not in active schools list
            const listResponse = await request(app)
                .get('/api/schools')
                .query({ status: 'active' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(listResponse.body.schools.find(s => s._id === testSchool._id))
                .toBeUndefined();
        }, 10000);

        test('should handle deletion of non-existent school', async () => {
            const nonExistentId = '507f1f77bcf86cd799439011';

            const response = await request(app)
                .delete(`/api/schools/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
        }, 10000);

        test('should prevent duplicate deletion', async () => {
            // First deletion
            await request(app)
                .delete(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            // Second deletion attempt
            const response = await request(app)
                .delete(`/api/schools/${testSchool._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('INVALID_OPERATION');
        }, 10000);
    });
});