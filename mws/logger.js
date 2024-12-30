export default ({ cortex }) => (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        cortex.publish('request:logged', {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration,
            timestamp: new Date()
        });
    });

    next();
};