import dotenv from 'dotenv';
import config from '../../config/index.config.js';
import mongo from '../../connect/mongo.js';
import cache from '../../cache/cache.dbh.js';
import Cortex from 'ion-cortex';
import Oyster from 'oyster-db';
import ManagersLoader from '../../loaders/ManagersLoaders.js';
import { schemas as validationSchemas } from '../../libs/validations/index.js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Mock Redis for testing
class MockRedis extends EventEmitter {
    constructor() {
        super();
        this.data = new Map();
    }

    async get(key) {
        return this.data.get(key);
    }

    async set(key, value) {
        this.data.set(key, value);
        return 'OK';
    }

    async del(key) {
        this.data.delete(key);
        return 1;
    }

    // Add other Redis methods as needed
    async quit() {
        return 'OK';
    }
}

class TestApplicationBootstrap {
    constructor() {
        // Load test environment variables
        dotenv.config({ path: '.env.test' });
        
        this.config = config;
        this.config.dotEnv.validation = validationSchemas;
        
        this.services = {
            mongo: null,
            cache: null,
            cortex: null,
            oyster: null,
            redis: null
        };
        this.managers = null;
    }

    async initialize() {
        try {
            // Initialize mock Redis
            this.services.redis = new MockRedis();

            // Initialize MongoDB
            await this.initializeMongo();
            
            // Initialize other services with mock Redis
            await this.initializeCache();
            await this.initializeCortex();
            await this.initializeOyster();
            
            // Initialize managers
            this.initializeManagers();

            // Return the Express app instance
            return this.managers.schoolServer.app;
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    async initializeMongo() {
        try {
            const { MONGO_URI } = this.config.dotEnv;
            if (!MONGO_URI) {
                throw new Error('MongoDB URI is not configured');
            }
            this.services.mongo = await mongo({ uri: MONGO_URI });
        } catch (error) {
            throw new Error(`MongoDB initialization failed: ${error.message}`);
        }
    }

    async initializeCache() {
        try {
            this.services.cache = {
                set: async (key, value) => this.services.redis.set(key, JSON.stringify(value)),
                get: async (key) => {
                    const value = await this.services.redis.get(key);
                    return value ? JSON.parse(value) : null;
                },
                del: async (key) => this.services.redis.del(key)
            };
        } catch (error) {
            throw new Error(`Cache initialization failed: ${error.message}`);
        }
    }

    async initializeCortex() {
        try {
            // Mock Cortex functionality
            this.services.cortex = {
                publish: (event, data) => {
                    console.log(`Mock Cortex publish: ${event}`, data);
                },
                subscribe: () => {},
                unsubscribe: () => {}
            };
        } catch (error) {
            throw new Error(`Cortex initialization failed: ${error.message}`);
        }
    }

    async initializeOyster() {
        try {
            // Mock Oyster functionality
            this.services.oyster = {
                get: async (key) => this.services.redis.get(key),
                set: async (key, value) => this.services.redis.set(key, value),
                del: async (key) => this.services.redis.del(key)
            };
        } catch (error) {
            throw new Error(`Oyster initialization failed: ${error.message}`);
        }
    }

    initializeManagers() {
        try {
            const managersLoader = new ManagersLoader({
                config: this.config,
                cache: this.services.cache,
                cortex: this.services.cortex,
                oyster: this.services.oyster,
                mongo: this.services.mongo
            });

            this.managers = managersLoader.load();
        } catch (error) {
            throw new Error(`Managers initialization failed: ${error.message}`);
        }
    }

    async cleanup() {
        try {
            // Close MongoDB connection
            if (this.services.mongo) {
                await this.services.mongo.connection.close();
            }

            // Clean up mock Redis
            if (this.services.redis) {
                await this.services.redis.quit();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

let testApp;
let appInstance;

export const getTestApp = async () => {
    if (!appInstance) {
        testApp = new TestApplicationBootstrap();
        appInstance = await testApp.initialize();
    }
    return appInstance;
};

export const cleanupTestApp = async () => {
    if (testApp) {
        await testApp.cleanup();
        testApp = null;
        appInstance = null;
    }
};