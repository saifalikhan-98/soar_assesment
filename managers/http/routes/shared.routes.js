import express from 'express';
import { schemas } from '../../../libs/validations/index.js';

export const setupSharedRoutes = (server) => {
    const router = express.Router();
    const { auth } = server.mws;
    const validationMw = server.mws.validation;


    // School details
    router.get('/schools/:schoolId',
        auth.checkSchoolAccess,
        validationMw.validateParams(schemas.school.getById),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.getSchool({
                    schoolId: req.validatedParams.schoolId
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

    // List classrooms
    router.get('/schools/:schoolId/classrooms',
        auth.checkSchoolAccess,
        validationMw.validateQuery(schemas.classroom.list),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.getClassrooms({
                    schoolId: req.params.schoolId,
                    ...req.validatedQuery
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

    // Mount the router
    server.app.use('/api', router);
};