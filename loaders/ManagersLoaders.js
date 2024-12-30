import SchoolManager from '../managers/school/School.manager.js';
import ClassroomManager from '../managers/classroom/Classroom.manager.js';
import StudentManager from '../managers/student/Student.manager.js';
import UserManager from '../managers/user/User.manager.js';
import SchoolServer from '../managers/http/Server.manager.js';
import validationMw from '../mws/validation.mw.js';
import authMw from '../mws/auth.mw.js';

class ManagersLoader {
    /**
     * Create a new ManagersLoader instance
     * @param {Object} params Initialization parameters
     * @param {Object} params.config Configuration object
     * @param {Object} params.cache Cache instance
     * @param {Object} params.cortex Cortex instance
     * @param {Object} params.oyster Oyster instance
     * @throws {Error} If required dependencies are missing
     */
    constructor({ config, cache, cortex, oyster, mongo } = {}) {
        if (!config) throw new Error('Config is required');
        if (!cache) throw new Error('Cache is required');
        if (!cortex) throw new Error('Cortex is required');
        if (!oyster) throw new Error('Oyster is required');

        this.config = config;
        this.cache = cache;
        this.cortex = cortex;
        this.oyster = oyster;
        this.mongo = mongo;
        this.isLoaded = false;
    }

    /**
     * Initialize and load all managers
     * @returns {Object} Initialized managers object
     * @throws {Error} If managers fail to initialize
     */
    load() {
        try {
            if (this.isLoaded) {
                return this.managers;
            }

            const dependencies = {
                config: this.config,
                cache: this.cache,
                cortex: this.cortex,
                oyster: this.oyster,
                mongo: this.mongo
            };
            
            const mws = {
                validation: validationMw({ config: this.config }),
                auth: authMw({ config: this.config }) // assuming you have this
            };

            const managers = {
                schoolManager: new SchoolManager(dependencies),
                classroomManager: new ClassroomManager(dependencies),
                studentManager: new StudentManager(dependencies),
                userManager: new UserManager(dependencies),
                schoolServer: new SchoolServer({
                    ...dependencies,
                    managers: this,
                    mws
                })
            };

            // Validate manager initialization
            for (const [key, manager] of Object.entries(managers)) {
                if (!manager || typeof manager !== 'object') {
                    throw new Error(`Failed to initialize ${key}`);
                }
            }

            // Inject the complete managers object into schoolServer
            managers.schoolServer.managers = managers;

            // Store managers for subsequent calls
            this.managers = managers;
            this.isLoaded = true;

            return managers;
        } catch (error) {
            throw new Error(`Failed to load managers: ${error.message}`);
        }
    }

    /**
     * Get a specific manager instance
     * @param {string} managerName Name of the manager to retrieve
     * @returns {Object} Manager instance
     * @throws {Error} If manager doesn't exist or isn't loaded
     */
    getManager(managerName) {
        if (!this.isLoaded) {
            throw new Error('Managers not loaded. Call load() first');
        }

        const manager = this.managers[managerName];
        if (!manager) {
            throw new Error(`Manager '${managerName}' not found`);
        }

        return manager;
    }

    /**
     * Check if all required managers are loaded and initialized
     * @returns {boolean} Whether all managers are ready
     */
    isReady() {
        return this.isLoaded && Object.values(this.managers).every(manager => manager !== null);
    }
}

export default ManagersLoader;