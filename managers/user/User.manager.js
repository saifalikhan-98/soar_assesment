import BaseManager from '../_common/Base.manager.js';
import bcrypt from 'bcrypt';
import { generateToken, toObjectId } from '../../libs/utils.js';



class UserManager extends BaseManager {
    constructor(deps) {
        super(deps);
        this.mongo=deps.mongo
        this.userExposed = [
            'createUser', 
            'login',
            'logout',
            'getSchoolAdmins',
            'assignAdminToSchool',
            'changePassword',
            'updateUser',
            'deactivateUser'
        ];
        this.initializeSuperAdmin()
    }
     // Add this method
     async initializeSuperAdmin() {
        try {
           
            if (!this.mongo) {
                throw new Error('MongoDB instance not available');
            }

            // Get the users collection
            const usersCollection = this.mongo.collection('users');
            if (!usersCollection) {
                throw new Error('Users collection not available');
            }

            const existingSuperAdmin = await usersCollection.findOne({ 
                role: 'superadmin', 
                status: 'active' 
            });

            if (existingSuperAdmin) {
                console.log('Superadmin exists with email:', existingSuperAdmin.email);
                return;
            }

            const email = this.config.dotEnv.SUPER_ADMIN_EMAIL;
            const password = this.config.dotEnv.SUPER_ADMIN_PASSWORD;

            if (!email || !password) {
                throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in environment variables');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await usersCollection.insertOne({
                email,
                password: hashedPassword,
                role: 'superadmin',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            console.log('Superadmin created successfully:', email);

            if (this.cortex?.publish) {
                this.cortex.publish('superadmin:initialized', {
                    userId: result.insertedId
                });
            }

            return result;
        } catch (error) {
            console.error('Failed to initialize superadmin:', error);
            throw error;
        }
    }

    async createUser({ email, password, role, schoolId }) {
        try {
            const usersCollection = this.mongo.collection('users');
            const schoolsCollection = this.mongo.collection('schools');
    
            // Check if user exists
            const existingUser = await usersCollection.findOne({ 
                email, 
                status: 'active' 
            });
    
            if (existingUser) {
                throw new Error('Email already exists');
            }
    
            // If creating school_admin, verify school exists and is active
            if (role === 'school_admin') {
                console.log(schoolId)
                const query={_id:toObjectId(schoolId),status:'active'}
                const school = await schoolsCollection.findOne(query);
                console.log(school)
                if (!school) {
                    throw new Error('School not found or inactive');
                }
            }
    
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
    
            // Create user
            const result = await usersCollection.insertOne({
                email,
                password: hashedPassword,
                role,
                schoolId: role === 'school_admin' ? schoolId : null,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLogin: null
            });
    
            const userDoc = await usersCollection.findOne({ _id: result.insertedId });
            const userResponse = { ...userDoc };
            delete userResponse.password;
    
            // Cache user data
            await this.cache.set(`user:${userResponse._id}`, userResponse);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:created', {
                    userId: userResponse._id,
                    role: userResponse.role,
                    schoolId: userResponse.schoolId
                });
            }
    
            return { user: userResponse };
        } catch (error) {
            throw new Error(`UserManager:createUser - ${error.message}`);
        }
    }
    

    async getSchoolAdmins(schoolId) {
        try {
            const usersCollection = this.mongo.collection('users');
            
            const admins = await usersCollection.find({ 
                schoolId,
                role: 'school_admin',
                status: 'active'
            }, {
                projection: { password: 0 }
            }).toArray();
    
            return { admins };
        } catch (error) {
            throw new Error(`UserManager:getSchoolAdmins - ${error.message}`);
        }
    }

    async assignAdminToSchool(schoolId, { userId }) {
        try {
            const usersCollection = this.mongo.collection('users');
            let schoolsCollection = this.mongo.collection('schools');
    
            // Verify school exists and is active
            const school = await schoolsCollection.findOne({ 
                _id: toObjectId(schoolId), 
                status: 'active' 
            });
    
            if (!school) {
                throw new Error('School not found or inactive');
            }
            console.log("school",school)
    
            // Update user's school assignment
            const result = await usersCollection.findOneAndUpdate(
                { 
                    _id: toObjectId(userId),
                    role: 'school_admin',
                    status: 'active'
                },
                {
                    $set: {
                        schoolId,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );
            console.log('result',result,result.value)
            schoolsCollection = this.mongo.collection('schools');
            const schoolUpdate = await schoolsCollection.findOneAndUpdate(
                { 
                    _id: toObjectId(schoolId),
                    status: 'active'
                },
                {
                    $set: {
                        adminId: toObjectId(userId),
                        updatedAt: new Date()
                    }
                },
                { 
                    returnDocument: 'after' 
                }
            );
    
            
    
            // Clear user cache
            await this.cache.del(`user:${userId}`);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:school:assigned', {
                    userId,
                    schoolId
                });
            }
    
            return { success: true };
        } catch (error) {
            throw new Error(`UserManager:assignAdminToSchool - ${error.message}`);
        }
    }

    async login({ email, password }) {
        try {
            const usersCollection = this.mongo.collection('users');
    
            // Get user
            const user = await usersCollection.findOne({ 
                email,
                status: 'active'
            });
            console.log(user)
            if (!user) {
                throw new Error('Invalid credentials');
            }
    
            // Check password
            console.log(password, user.password)
            
            const validPassword = await bcrypt.compare(password, user.password);
            console.log(validPassword);
            if (!validPassword) {
                throw new Error('Invalid credentials');
            }
    
            // Update last login
            await usersCollection.updateOne(
                { _id: toObjectId(user._id) },
                {
                    $set: {
                        lastLogin: new Date(),
                        updatedAt: new Date()
                    }
                }
            );
    
            // Generate token
            const accessToken=generateToken(this.config.dotEnv.LONG_TOKEN_SECRET, user)
            
            // Prepare response
            const userResponse = { ...user };
            delete userResponse.password;
    
            // Cache user data
            await this.cache.set(`user:${user._id}`, userResponse);
            await this.cache.set(`token:${accessToken}`, true, 7 * 24 * 60 * 60);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:loggedin', {
                    userId: user._id,
                    role: user.role
                });
            }
    
            return {
                user: userResponse,
                accessToken
            };
        } catch (error) {
            throw new Error(`UserManager:login - ${error.message}`);
        }
    }

    async changePassword(userId, { currentPassword, newPassword }) {
        try {
            const usersCollection = this.mongo.collection('users');
    
            // Get user
            const user = await usersCollection.findOne({ 
                _id: toObjectId(userId),
                status: 'active'
            });
    
            if (!user) {
                throw new Error('User not found');
            }
    
            // Verify current password
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                throw new Error('Current password is incorrect');
            }
    
            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
    
            // Update password
            const result = await usersCollection.updateOne(
                { _id: toObjectId(userId) },
                {
                    $set: {
                        password: hashedPassword,
                        updatedAt: new Date()
                    }
                }
            );
    
            if (result.modifiedCount === 0) {
                throw new Error('Failed to update password');
            }
    
            // Clear user cache to force re-login
            await this.cache.del(`user:${userId}`);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:password:changed', { userId });
            }
    
            return { success: true };
        } catch (error) {
            throw new Error(`UserManager:changePassword - ${error.message}`);
        }
    }

    async deactivateUser(userId) {
        try {
            const usersCollection = this.mongo.collection('users');
    
            const result = await usersCollection.findOneAndUpdate(
                { _id: toObjectId(userId) },
                {
                    $set: {
                        status: 'inactive',
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            );
    
            if (!result.value) {
                throw new Error('User not found');
            }
    
            // Clear user cache
            await this.cache.del(`user:${userId}`);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:deactivated', { userId });
            }
    
            return { success: true };
        } catch (error) {
            throw new Error(`UserManager:deactivateUser - ${error.message}`);
        }
    }

    async logout(userId, token) {
        try {
            // Remove token from cache
            await this.cache.del(`token:${token}`);
            await this.cache.del(`user:${userId}`);
    
            // Emit event
            if (this.cortex?.publish) {
                this.cortex.publish('user:loggedout', { userId });
            }
    
            return { success: true };
        } catch (error) {
            throw new Error(`UserManager:logout - ${error.message}`);
        }
    }
}

export default UserManager;