import Redis from 'ioredis';

export default ({ prefix, url }) => {
    const redis = new Redis(url, {
        keyPrefix: prefix,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    redis.on('error', (error) => {
        console.error('Redis Error:', error);
    });

    return {
        async get(key) {
            try {
                const value = await redis.get(key);
                return value ? JSON.parse(value) : null;
            } catch (error) {
                console.error('Cache Get Error:', error);
                return null;
            }
        },

        async set(key, value, expiry = 3600) {
            try {
                await redis.set(
                    key,
                    JSON.stringify(value),
                    'EX',
                    expiry
                );
                return true;
            } catch (error) {
                console.error('Cache Set Error:', error);
                return false;
            }
        },

        async del(key) {
            try {
                await redis.del(key);
                return true;
            } catch (error) {
                console.error('Cache Delete Error:', error);
                return false;
            }
        },

        async clear() {
            try {
                await redis.flushdb();
                return true;
            } catch (error) {
                console.error('Cache Clear Error:', error);
                return false;
            }
        }
    };
};