import mongoose from 'mongoose';

export default async ({ uri }) => {
    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db; // Get the database instance
        console.log('MongoDB connected to:', uri);
        return db; // Return the database instance instead of connection
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        throw error;
    }
}