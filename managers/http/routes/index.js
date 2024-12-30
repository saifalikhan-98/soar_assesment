import { setupAuthRoutes } from './auth.routes.js';
import { setupSuperAdminRoutes } from './superadmin.routes.js';
import { setupSchoolAdminRoutes } from './schoolAdmin.routes.js';
import { setupSharedRoutes } from './shared.routes.js';

export const setupRoutes = async (server) => {
    if (!server || !server.app || !server.mws || !server.mws.auth) {
        throw new Error('Invalid server configuration');
    }

    const API_PREFIX = '/api';
    
    try {
        // Setup public routes first (no token required)
        setupAuthRoutes(server);
        
        // Setup auth middleware for protected routes
        server.app.use(API_PREFIX, server.mws.auth.verifyToken);

        // Setup role-based routes
        setupSuperAdminRoutes(server);
        setupSchoolAdminRoutes(server);
        
        // Setup shared routes last (accessible by multiple roles)
        setupSharedRoutes(server);

        // Global error handler for routes
        server.app.use(API_PREFIX, (err, req, res, next) => {
            console.error('Route Error:', err);
            server.responseDispatcher.dispatch(res, {
                ok: false,
                errors: [err.message || 'Internal server error'],
                code: err.code || 500
            });
        });

    } catch (error) {
        console.error('Failed to setup routes:', error);
        throw error;
    }
};