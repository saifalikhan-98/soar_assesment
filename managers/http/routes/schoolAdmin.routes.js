import express from 'express';
import { schemas } from '../../../libs/validations/index.js';

export const setupSchoolAdminRoutes = (server) => {
    const router = express.Router();
    const { auth } = server.mws;
    const validationMw = server.mws.validation;

    
    const schoolAdminMiddleware = [
        auth.checkRole(['school_admin', 'superadmin']),
        auth.checkSchoolAccess
    ];

    // Classroom Management Routes
    router.post('/schools/:schoolId/classrooms',
        ...schoolAdminMiddleware,
        validationMw.validateBody(schemas.classroom.create),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.createClassroom({
                    ...req.validatedBody,
                    schoolId: req.params.schoolId
                });
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

    router.get('/schools/:schoolId/classrooms/:classroomId',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.classroom.getById),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.getClassroom({
                    classroomId: req.params.classroomId,
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

    router.patch('/schools/:schoolId/classrooms/:classroomId',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.classroom.getById),
        validationMw.validateBody(schemas.classroom.update),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.updateClassroom({
                    classroomId: req.params.classroomId,
                    schoolId: req.params.schoolId,
                    ...req.validatedBody
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

    router.patch('/schools/:schoolId/classrooms/:classroomId/resources',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.classroom.getById),
        validationMw.validateBody(schemas.classroom.updateResources),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.updateResources({
                    classroomId: req.params.classroomId,
                    schoolId: req.params.schoolId,
                    resources: req.validatedBody.resources
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

    router.delete('/schools/:schoolId/classrooms/:classroomId',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.classroom.getById),
        async (req, res) => {
            try {
                await server.managers.classroomManager.deleteClassroom({
                    classroomId: req.params.classroomId,
                    schoolId: req.params.schoolId
                });
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    message: 'Classroom deleted successfully'
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    router.patch('/schools/:schoolId/classrooms/bulk',
        ...schoolAdminMiddleware,
        validationMw.validateBody(schemas.classroom.bulkUpdate),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.bulkUpdateClassrooms({
                    schoolId: req.params.schoolId,
                    updates: req.validatedBody.updates
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

    router.get('/schools/:schoolId/classrooms/:classroomId/stats',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.classroom.getById),
        async (req, res) => {
            try {
                const result = await server.managers.classroomManager.getClassroomStats({
                    classroomId: req.params.classroomId,
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

    // Student Management Routes
    router.post('/schools/:schoolId/students',
        ...schoolAdminMiddleware,
        validationMw.validateBody(schemas.student.enroll),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.enrollStudent({
                    ...req.validatedBody,
                    schoolId: req.params.schoolId
                });
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

    router.get('/schools/:schoolId/students',
        ...schoolAdminMiddleware,
        validationMw.validateQuery(schemas.student.list),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.getStudents({
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

    router.get('/schools/:schoolId/students/:studentId',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.student.getById),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.getStudent({
                    studentId: req.params.studentId,
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

    router.patch('/schools/:schoolId/students/:studentId',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.student.getById),
        validationMw.validateBody(schemas.student.update),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.updateStudent({
                    studentId: req.params.studentId,
                    schoolId: req.params.schoolId,
                    updates: req.validatedBody
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

    router.post('/schools/:schoolId/students/:studentId/transfer',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.student.getById),
        validationMw.validateBody(schemas.student.transfer),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.transferStudent({
                    studentId: req.params.studentId,
                    fromSchoolId: req.params.schoolId,
                    toSchoolId: req.validatedBody.toSchoolId,
                    reason: req.validatedBody.reason
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

    router.post('/schools/:schoolId/students/:studentId/deactivate',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.student.getById),
        validationMw.validateBody(schemas.student.deactivate),
        async (req, res) => {
            try {
                const result = await server.managers.studentManager.deactivateStudent({
                    studentId: req.params.studentId,
                    schoolId: req.params.schoolId,
                    reason: req.validatedBody.reason
                });
                server.responseDispatcher.dispatch(res, {
                    ok: true,
                    data: result,
                    message: 'Student deactivated successfully'
                });
            } catch (error) {
                server.responseDispatcher.dispatch(res, {
                    ok: false,
                    errors: [error.message]
                });
            }
        }
    );

    // School Stats Route
    router.get('/schools/:schoolId/stats',
        ...schoolAdminMiddleware,
        validationMw.validateParams(schemas.school.getById),
        async (req, res) => {
            try {
                const result = await server.managers.schoolManager.getSchoolStats(
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

  
    server.app.use('/api', router);
};