import { MongoClient, type Db, type Collection, type Document } from "mongodb";

import * as constant from '../utils/const.ts'


let client: MongoClient | null = null;
let db: Db | null = null;

// Evita connessioni multiple se connectDB() viene chiamata in parallelo
let connecting: Promise<Db> | null = null;

/** Apre la connessione (una sola volta) e restituisce il database. */
export async function connectDB(): Promise<Db> {
  
  if (db) {
    return db;
  }
    
  if (connecting) return connecting;

  connecting = (async () => {
    const newClient = new MongoClient(constant.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await newClient.connect();
      await newClient.db(constant.dbName).command({ ping: 1 });
    } catch (err) {
      await newClient.close().catch(() => {});
      connecting = null;
      throw err;
    }

    client = newClient;
    db = newClient.db(constant.dbName);
    console.log(`[mongo] connesso a "${constant.dbName}"`);
    return db;
  })();

  return connecting;
}

/** Restituisce il database già connesso (da usare dopo connectDB). */
export function getDB(): Db {
  if (!db) {
    throw new Error("MongoDB non connesso: chiama prima connectDB()");
  }
  return db;
}

/** Scorciatoia per ottenere una collection tipizzata. */
export function getCollection<T extends Document = Document>(
  name: string,
): Collection<T> {
  return getDB().collection<T>(name);
}

/** Chiude la connessione. */
export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connecting = null;
    console.log("[mongo] connessione chiusa");
  }
}

// Chiusura pulita quando il processo viene fermato
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await closeDB();
    process.exit(0);
  });
}

