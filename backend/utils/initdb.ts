import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
// Collection da creare automaticamente se mancano
const REQUIRED_COLLECTIONS = process.env.REQUIRED_COLLECTIONS;

import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import type { IUser } from "../user/IUser.ts";

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
    const newClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    try {
      await newClient.connect();
      await newClient.db(dbName).command({ ping: 1 });

      
    } catch (err) {
      await newClient.close().catch(() => {});
      connecting = null;
      throw err;
    }

    client = newClient;
    db = newClient.db(dbName);
    console.log(`[mongo] connesso a "${dbName}"`);
    await ensureCollections(db);
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


 
/**
 * MongoDB crea il database solo alla prima scrittura: creando
 * esplicitamente le collection, il database compare subito.
 */
async function ensureCollections(database: Db): Promise<void> {
  const existing = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );
 
  for (const name of JSON.parse(REQUIRED_COLLECTIONS)) {
    if (!existing.has(name)) {
      await database.createCollection(name);
      console.log(`[mongo] collection "${name}" creata`);

      if(name=="user") {
        const user = getCollection<IUser>("user");
        await user.insertOne({ firstName: "Brian", lastName: "Fox"});
      }
    }
  }
}


connectDB()