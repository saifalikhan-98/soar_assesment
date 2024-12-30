import express from 'express';
import { schemas } from '../../../libs/validations/index.js';

export const setupAuthRoutes = (server) => {
    const router = express.Router();
    const { auth } = server.mws;
    const validationMw = server.mws.validation;


    // Public routes (no auth required)
    router.post('/auth/login',
        validationMw.validateBody(schemas.user.login),
        async (req, res) => {
            try {
                const result = await server.managers.userManager.login(req.validatedBody);
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    data: result
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message],
                    code: 401
                });
            }
        }
    );

    // Protected routes
    router.use(auth.verifyToken);

    // Superadmin routes
    router.post('/users',
        auth.checkRole(['superadmin']),
        validationMw.validateBody(schemas.user.create),
        async (req, res) => {
            try {
                const result = await server.managers.userManager.createUser(req.validatedBody);
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    data: result,
                    code: 201
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    router.get('/schools/:schoolId/admins',
        auth.checkRole(['superadmin']),
        validationMw.validateParams(schemas.school.getById),
        async (req, res) => {
            try {
                const result = await server.managers.userManager.getSchoolAdmins(
                    req.validatedParams.schoolId
                );
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    data: result
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    router.post('/schools/:schoolId/admins',
        auth.checkRole(['superadmin']),
        validationMw.validateParams(schemas.school.getById),
        validationMw.validateBody(schemas.user.assignAdmin),
        async (req, res) => {
            try {
                const result = await server.managers.userManager.assignAdminToSchool(
                    req.validatedParams.schoolId,
                    req.validatedBody
                );
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    data: result
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    // Shared routes (accessible to all authenticated users)
    router.post('/auth/change-password',
        validationMw.validateBody(schemas.user.changePassword),
        async (req, res) => {
            try {
                await server.managers.userManager.changePassword(
                    req.user.id,
                    req.validatedBody
                );
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    message: 'Password updated successfully'
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    router.post('/auth/logout',
        async (req, res) => {
            try {
                await server.managers.userManager.logout(req.user.id, req.token);
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    message: 'Logged out successfully'
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    // Mount the router
    server.app.use('/api', router);
};