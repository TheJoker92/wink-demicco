import dotenv from 'dotenv';
dotenv.config();

export const port = process.env.PORT

export const uri = process.env.MONGODB_URI;
export const dbName = process.env.MONGODB_DB;
