import { verifyJwtToken } from "../libs/utils.js";

export default ({ config, utils, cache }) => {
    return {
        verifyToken: async (req, res, next) => {
            try {
                const token = req.headers.authorization?.replace('Bearer ', '');
                if (!token) throw new Error('missing token');
                
                const decoded = verifyJwtToken(token,config.dotEnv.LONG_TOKEN_SECRET);
                
                req.user = decoded;
                
               
                
                next();
            } catch (error) {
                res.status(401).json({
                    ok: false,
                    errors: ['Authentication failed']
                });
            }
        },

        checkRole: (roles) => async (req, res, next) => {
           
            try {
                if (!roles.includes(req.user.role)) {
                    throw new Error('unauthorized role');
                }
                next();
            } catch (error) {
                res.status(403).json({
                    ok: false,
                    errors: ['Access denied']
                });
            }
        },

        checkSchoolAccess: async (req, res, next) => {
            try {
                const schoolId = req.params.schoolId;
                if (!schoolId) throw new Error('missing school id');

                if (req.user.role === 'superadmin') {
                    return next();
                }

                if (req.user.role === 'school_admin' && req.user.schoolId === schoolId) {
                    return next();
                }

                throw new Error('unauthorized school access');
            } catch (error) {
                res.status(403).json({
                    ok: false,
                    errors: ['Access denied']
                });
            }
        }
    };
};