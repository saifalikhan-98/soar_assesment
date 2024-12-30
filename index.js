import dotenv from 'dotenv';
import config from './config/index.config.js';
import mongo from './connect/mongo.js';
import cache from './cache/cache.dbh.js';
import Cortex from 'ion-cortex';
import Oyster from 'oyster-db';
import ManagersLoader from './loaders/ManagersLoaders.js';
import { schemas as validationSchemas } from './libs/validations/index.js';


// Initialize environment variables
dotenv.config();

class ApplicationBootstrap {
    constructor() {
        this.config = config;
       
        
        this.config.dotEnv.validation = validationSchemas;
        
        this.services = {
            mongo: null,
            cache: null,
            cortex: null,
            oyster: null
        };
        this.managers = null;
    }

    /**
     * Initialize MongoDB connection
     * @throws {Error} If MongoDB connection fails
     */
    async initializeMongo() {
        try {
            const { MONGO_URI } = this.config.dotEnv;
            if (!MONGO_URI) {
                throw new Error('MongoDB URI is not configured');
            }
            
            // Store the database instance
            this.services.mongo = await mongo({ uri: MONGO_URI });
            console.log('✓ MongoDB connected successfully');
        } catch (error) {
            throw new Error(`MongoDB initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize Redis cache
     * @throws {Error} If cache initialization fails
     */
    initializeCache() {
        try {
            const { CACHE_PREFIX, CACHE_REDIS } = this.config.dotEnv;
            if (!CACHE_REDIS) {
                throw new Error('Cache Redis URL is not configured');
            }

            this.services.cache = cache({
                prefix: CACHE_PREFIX,
                url: CACHE_REDIS
            });
            console.log('✓ Cache initialized successfully');
        } catch (error) {
            throw new Error(`Cache initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize Cortex service
     * @throws {Error} If Cortex initialization fails
     */
    initializeCortex() {
        try {
            const { 
                CORTEX_PREFIX, 
                CORTEX_REDIS, 
                CORTEX_TYPE 
            } = this.config.dotEnv;

            if (!CORTEX_REDIS) {
                throw new Error('Cortex Redis URL is not configured');
            }

            this.services.cortex = new Cortex({
                prefix: CORTEX_PREFIX,
                url: CORTEX_REDIS,
                type: CORTEX_TYPE,
                state: () => ({}),
                activeDelay: "50",
                idlDelay: "200",
            });
            console.log('✓ Cortex initialized successfully');
        } catch (error) {
            throw new Error(`Cortex initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize Oyster service
     * @throws {Error} If Oyster initialization fails
     */
    initializeOyster() {
        try {
            this.services.oyster = new Oyster({
                url: this.config.dotEnv.REDIS_URI,
                prefix: this.config.dotEnv.OYSTER_PREFIX
            });
            console.log('✓ Oyster initialized successfully');
        } catch (error) {
            throw new Error(`Oyster initialization failed: ${error.message}`);
        }
    }
    /**
     * Initialize all managers
     * @throws {Error} If managers initialization fails
     */
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
            console.log('✓ Managers initialized successfully');
        } catch (error) {
            throw new Error(`Managers initialization failed: ${error.message}`);
        }
    }

    /**
     * Start the application server
     * @throws {Error} If server fails to start
     */
    async startServer() {
        try {
            await this.managers.schoolServer.run();
            console.log('✓ Server started successfully');
        } catch (error) {
            throw new Error(`Server start failed: ${error.message}`);
        }
    }

    /**
     * Handle application shutdown
     */
    handleShutdown() {
        process.on('SIGTERM', this.shutdown.bind(this));
        process.on('SIGINT', this.shutdown.bind(this));
    }

    /**
     * Graceful shutdown of services
     */
    async shutdown() {
        console.log('\nInitiating graceful shutdown...');
        
        try {
            // Close MongoDB connection
            if (this.services.mongo) {
                await this.services.mongo.connection.close();
                console.log('✓ MongoDB connection closed');
            }

            // Close other services as needed
            // Add cleanup for other services here

            console.log('✓ Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }

    /**
     * Start the application
     */
    async start() {
        try {
            console.log('Starting application...');
            
            // Initialize all services
            await this.initializeMongo();
            this.initializeCache();
            this.initializeCortex();
            this.initializeOyster();
            this.initializeManagers();
            
            // Start server
            await this.startServer();
            
            // Setup shutdown handlers
            this.handleShutdown();
            
            console.log('Application started successfully! 🚀');
        } catch (error) {
            
            console.error('Application startup failed:', error);
            await this.shutdown();
        }
    }
}

// Create and start application
const app = new ApplicationBootstrap();
app.start().catch(error => {
    console.error('Fatal application error:', error);
    process.exit(1);
});