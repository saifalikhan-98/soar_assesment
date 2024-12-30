import express from 'express';
import cors from 'cors';
import ResponseDispatcher from '../response_dispatcher/ResponseDispatcher.manager.js';
import { setupAuthRoutes } from './routes/auth.routes.js';
import { setupSuperAdminRoutes } from './routes/admin.routes.js';
import { setupSchoolAdminRoutes } from './routes/schoolAdmin.routes.js';
import { setupSharedRoutes } from './routes/shared.routes.js';

export default class SchoolServer {
    constructor({ config, managers, cortex, utils, mws }) {
        this.config = config;
        this.managers = managers;
        this.cortex = cortex;
        this.utils = utils;
        this.mws = mws;
        
        this.app = express();
        this.responseDispatcher = new ResponseDispatcher();
        this.key = 'schoolServer';
        this.validationMw = mws.validation;
    }

    async run() {
        try {
            // Basic middleware
            this.app.use(express.json());
            this.app.use(cors());

            // Setup routes
            await this.setupRoutes();

            // Error handler
            this.app.use(this.errorHandler.bind(this));

            // Start server
            await this.startServer();

        } catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    }

    async setupRoutes() {
        // Setup authentication routes (no token required)
        setupAuthRoutes(this);
        
        // Auth middleware for protected routes
        this.app.use('/api', this.mws.auth.verifyToken);

        // Routes with aligned RBAC pattern
        setupSuperAdminRoutes(this);
        setupSchoolAdminRoutes(this);
        setupSharedRoutes(this);
    }

    async startServer() {
        const port = this.config.dotEnv.USER_PORT;
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, () => {
                console.log(`${this.key} running on port ${port}`);
                resolve();
            }).on('error', (error) => {
                console.error('Failed to start server:', error);
                reject(error);
            });
        });
    }

    errorHandler(err, req, res, next) {
        // Log error through cortex if available
        if (this.cortex?.publish) {
            this.cortex.publish('error:occurred', {
                service: this.key,
                error: err.message,
                path: req.path
            });
        } else {
            console.error(`[${this.key}] Error:`, {
                error: err.message,
                path: req.path
            });
        }

        this.responseDispatcher.dispatch(res, {
            ok: false,
            errors: [err.message],
            code: err.code || 500
        });
    }
}