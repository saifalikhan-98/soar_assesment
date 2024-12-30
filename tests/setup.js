// tests/setup.js
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { getTestApp } from './utils/testApp.js';

beforeAll(async () => {
  // Set the timeout for all tests
  jest.setTimeout(30000);
});

afterAll(async () => {
  // Close any open connections
  await mongoose.connection.close();
});

export const setupTestDB = async () => {
  const app = await getTestApp();
  return {
    client: mongoose.connection,
    db: mongoose.connection.db
  };
};

// Mock data
export const mockSchool = {
  name: "Test School",
  address: {
    street: "123 Test St",
    city: "Test City",
    state: "TX",
    zipCode: "12345"
  },
  contactInfo: {
    email: "test@school.com",
    phone: "+1234567890"
  }
};

export const mockClassroom = {
  name: "Test Classroom",
  capacity: 30,
  resources: ["Projector", "Whiteboard"]
};

export const mockStudent = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@test.com",
  grade: 10,
  guardianInfo: {
    name: "Jane Doe",
    relationship: "Mother",
    phone: "+1234567890",
    email: "jane.doe@test.com"
  }
};

export const mockUsers = {
    admin: {
        email: "admin@test.com",
        password: "Admin123!",
        role: "superadmin"
    },
    schoolAdmin: {
        email: "schooladmin@test.com",
        password: "SchoolAdmin123!",
        role: "school_admin"
    },
    teacher: {
        email: "teacher@test.com",
        password: "Teacher123!",
        role: "teacher"
    }
};

// Helper functions
export const clearCollections = async (db) => {
  if (!db) return;
  const collections = ['schools', 'classrooms', 'students', 'users'];
  await Promise.all(
    collections.map(collection => db.collection(collection).deleteMany({}))
  );
};

export const getAuthToken = async (request, app) => {
  try {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Admin123!'
      });
    return response.body.token;
  } catch (error) {
    console.error('Auth token generation failed:', error);
    throw error;
  }
};