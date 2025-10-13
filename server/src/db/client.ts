import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDatabaseFilePath } from './config.js';

const sqlite = new Database(getDatabaseFilePath());

export const db = drizzle(sqlite);


