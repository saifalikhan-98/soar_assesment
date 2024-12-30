import express from 'express';
import { schemas } from '../../../libs/validations/index.js';

export const setupSuperAdminRoutes = (server) => {
    const router = express.Router();
    const { auth } = server.mws;
    const validationMw = server.mws.validation;


    // Common middleware for superadmin routes
    const superAdminMiddleware = [
        auth.checkRole(['superadmin'])
    ];

    // Users Management Routes
    router.post('/users',
        ...superAdminMiddleware,
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

    // Schools Management Routes
    router.post('/schools',
        ...superAdminMiddleware,
        validationMw.validateBody(schemas.school.create),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.createSchool(req.validatedBody);
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

    router.get('/schools',
        ...superAdminMiddleware,
        validationMw.validateQuery(schemas.school.list),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.getSchools(req.validatedQuery);
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

    router.get('/schools/:schoolId',
        ...superAdminMiddleware,
        validationMw.validateParams(schemas.school.getById),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.getSchoolStats({ 
                    schoolId: req.params.schoolId 
                });
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

    router.patch('/schools/:schoolId',
        ...superAdminMiddleware,
        validationMw.validateParams(schemas.school.getById),
        validationMw.validateBody(schemas.school.update),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.updateSchool(
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

    router.delete('/schools/:schoolId',
        ...superAdminMiddleware,
        validationMw.validateParams(schemas.school.getById),
        async (req, res) => {
            try {
                await server.managers.schoolManager.deleteSchool(req.validatedParams.schoolId);
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    message: 'School deleted successfully'
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