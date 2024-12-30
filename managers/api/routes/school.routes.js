import { Router } from 'express';
import { schemas } from '../../libs/validations/index.js';
import AppError from '../../libs/errors/AppError.js';

const { school, classroom, student } = schemas;

export default class SchoolRoutes {
    /**
     * Initialize school routes
     * @param {Object} params Configuration parameters
     * @param {Object} params.managers Service managers
     * @param {Object} params.responseDispatcher Response handling utility
     * @param {Object} params.auth Authentication middleware
     * @param {Object} params.validationMw Validation middleware
     */
    constructor({ managers, responseDispatcher, auth, validationMw }) {
        this.managers = managers;
        this.responseDispatcher = responseDispatcher;
        this.auth = auth;
        this.validationMw = validationMw;
        this.router = Router();
        
        this.initializeRoutes();
    }

    /**
     * Initialize all routes
     */
    initializeRoutes() {
        // School routes
        this.router.post('/schools', 
            this.auth.verifyToken, 
            this.auth.checkRole(['superadmin']),
            this.validationMw.validateBody(school.create),
            this.createSchool.bind(this)
        );

        this.router.get('/schools/:schoolId',
            this.auth.verifyToken,
            this.auth.checkSchoolAccess,
            this.validationMw.validateParams(school.getById),
            this.getSchool.bind(this)
        );

        // Classroom routes
        this.router.post('/schools/:schoolId/classrooms',
            this.auth.verifyToken,
            this.auth.checkSchoolAccess,
            this.validationMw.validateBody(classroom.create),
            this.createClassroom.bind(this)
        );

        // Student routes
        this.router.post('/schools/:schoolId/students',
            this.auth.verifyToken,
            this.auth.checkSchoolAccess,
            this.validationMw.validateBody(student.enroll),
            this.enrollStudent.bind(this)
        );

        // Additional routes
        this.router.get('/schools',
            this.auth.verifyToken,
            this.validationMw.validateQuery(school.list),
            this.listSchools.bind(this)
        );

        this.router.put('/schools/:schoolId',
            this.auth.verifyToken,
            this.auth.checkSchoolAccess,
            this.validationMw.validateParams(school.getById),
            this.validationMw.validateBody(school.update),
            this.updateSchool.bind(this)
        );
    }

    /**
     * Create a new school
     */
    async createSchool(req, res, next) {
        try {
            const result = await this.managers.schoolManager.createSchool(req.validatedBody);
            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * Get school details
     */
    async getSchool(req, res, next) {
        try {
            const result = await this.managers.schoolManager.getSchool({
                schoolId: req.validatedParams.schoolId
            });

            if (!result) {
                throw new AppError('RESOURCE_NOT_FOUND', 'School not found');
            }

            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * Create a new classroom in a school
     */
    async createClassroom(req, res, next) {
        try {
            const result = await this.managers.classroomManager.createClassroom({
                ...req.validatedBody,
                schoolId: req.validatedParams.schoolId
            });
            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * Enroll a new student in a school
     */
    async enrollStudent(req, res, next) {
        try {
            const result = await this.managers.studentManager.enrollStudent({
                ...req.validatedBody,
                schoolId: req.validatedParams.schoolId
            });
            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * List schools with pagination and filters
     */
    async listSchools(req, res, next) {
        try {
            const result = await this.managers.schoolManager.listSchools(req.validatedQuery);
            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * Update school details
     */
    async updateSchool(req, res, next) {
        try {
            const result = await this.managers.schoolManager.updateSchool(
                req.validatedParams.schoolId,
                req.validatedBody
            );
            this.responseDispatcher.dispatch(res, {
                ok: true,
                data: result
            });
        } catch (error) {
            next(error instanceof AppError ? error : new AppError('DATABASE_ERROR', error.message));
        }
    }

    /**
     * Get the configured router
     * @returns {Router} Express router
     */
    getRouter() {
        return this.router;
    }
}