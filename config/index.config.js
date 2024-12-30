import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { slugify } from '../libs/utils.js';

dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf8')
);
const { name } = packageJson;

// Base configuration
const config = {
    dotEnv: {}
};

// Environment variables
config.dotEnv = {
    SERVICE_NAME: process.env.SERVICE_NAME ? slugify(process.env.SERVICE_NAME) : name,
    USER_PORT: process.env.USER_PORT || 5111,
    ADMIN_PORT: process.env.ADMIN_PORT || 5222,
    ADMIN_URL: process.env.ADMIN_URL || `http://localhost:${process.env.ADMIN_PORT || 5222}`,
    ENV: process.env.ENV || "development",
    REDIS_URI: process.env.REDIS_URI || "redis://127.0.0.1:6379",
    
    // Core service configuration
    CORTEX_REDIS: process.env.CORTEX_REDIS || process.env.REDIS_URI || "redis://127.0.0.1:6379",
    CORTEX_PREFIX: process.env.CORTEX_PREFIX || 'school_sys',
    CORTEX_TYPE: process.env.CORTEX_TYPE || (process.env.SERVICE_NAME ? slugify(process.env.SERVICE_NAME) : name),
    
    // Oyster configuration
    OYSTER_REDIS: process.env.OYSTER_REDIS || process.env.REDIS_URI || "redis://127.0.0.1:6379",
    OYSTER_PREFIX: process.env.OYSTER_PREFIX || 'school_data',
    
    // Cache configuration
    CACHE_REDIS: process.env.CACHE_REDIS || process.env.REDIS_URI || "redis://127.0.0.1:6379",
    CACHE_PREFIX: process.env.CACHE_PREFIX || `${process.env.SERVICE_NAME ? slugify(process.env.SERVICE_NAME) : name}:ch`,
    
    // Database configuration
    MONGO_URI: process.env.MONGO_URI || `mongodb://localhost:27017/${process.env.SERVICE_NAME ? slugify(process.env.SERVICE_NAME) : name}`,
    
    // Security configuration
    LONG_TOKEN_SECRET: process.env.LONG_TOKEN_SECRET || null,
    SHORT_TOKEN_SECRET: process.env.SHORT_TOKEN_SECRET || null,
    NACL_SECRET: process.env.NACL_SECRET || null,
    
    // School-specific configuration
    MAX_STUDENTS_PER_CLASSROOM: process.env.MAX_STUDENTS_PER_CLASSROOM || 30,
    DEFAULT_SCHOOL_LICENSE_DAYS: process.env.DEFAULT_SCHOOL_LICENSE_DAYS || 365,

    //Super admin
    SUPER_ADMIN_EMAIL:process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD:process.env.SUPER_ADMIN_PASSWORD
};

// Validate required environment variables
const requiredEnvVars = ['LONG_TOKEN_SECRET', 'SHORT_TOKEN_SECRET', 'NACL_SECRET','SUPER_ADMIN_EMAIL','SUPER_ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !config.dotEnv[varName]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Load environment specific config
try {
    const envConfig = await import(join(__dirname, `./envs/${config.dotEnv.ENV}.js`));
    // Merge environment specific config with base config
    Object.assign(config, envConfig.default);
} catch (error) {
    console.warn(`No environment specific config found for "${config.dotEnv.ENV}" or error loading it:`, error.message);
}


export default config;