import { ObjectId, type Filter } from "mongodb";
import { connectDB, getCollection } from "../utils/db.ts";

const COLLECTION = "post";
const DEFAULT_AUTHOR = "Brian Fox";

import type { IPost, NewPost, PostChanges, PostFilter, PostStatus } from "./utils.ts";
import { STATUSES } from "./utils.ts";

// ---------- helper ----------

function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new Error("ID non valido");
  return new ObjectId(id);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Il campo '${field}' è obbligatorio: ${value}`);
  }
  return value.trim();
}

function parseStatus(value: unknown): PostStatus {
  if (!STATUSES.includes(value as PostStatus)) {
    throw new Error(`Status non valido (ammessi: ${STATUSES.join(", ")})`);
  }
  return value as PostStatus;
}

/** Toglie '#', spazi e maiuscole, rimuove i duplicati. */
function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((h) => typeof h !== "string")) {
    throw new Error("'hashtags' deve essere un array di stringhe");
  }
  const clean = value
    .map((h: string) => h.trim().replace(/^#+/, "").toLowerCase())
    .filter((h) => h !== "");
  return [...new Set(clean)];
}

// ---------- CRUD ----------

/** CREATE: status di default "draft", author di default "Brian Fox". */
export async function createPost(input: NewPost) {
  const post: IPost = {
    title: requireText(input.title, "title"),
    body: requireText(input.body, "body"),
    hashtags: normalizeHashtags(input.hashtags ?? []),
    status: input.status === undefined ? "draft" : parseStatus(input.status),
    author:
      input.author === undefined
        ? DEFAULT_AUTHOR
        : requireText(input.author, "author"),
  };

  await connectDB()

  const result = await getCollection<IPost>(COLLECTION).insertOne({ ...post });
  return { _id: result.insertedId, ...post };
}

/** READ (lista): filtri opzionali per status, autore e hashtag. */
export async function getPosts(filter: PostFilter = {}) {
  await connectDB()

  const query: Filter<IPost> = {};
  if (filter.status !== undefined) query.status = parseStatus(filter.status);
  if (filter.author !== undefined) query.author = filter.author;
  if (filter.hashtag !== undefined) {
    query.hashtags = filter.hashtag.trim().replace(/^#+/, "").toLowerCase();
  }

  return getCollection<IPost>(COLLECTION)
    .find(query)
    .sort({ _id: -1 }) // i più recenti per primi
    .toArray();
}

/** READ (singolo): restituisce null se non esiste. */
export async function getPostById(id: string) {
  await connectDB()
  return getCollection<IPost>(COLLECTION).findOne({ _id: toObjectId(id) });
}

/** UPDATE: modifica solo i campi passati. Restituisce il post aggiornato o null. */
export async function updatePost(id: string, changes: PostChanges) {
  await connectDB()
  const set: Partial<IPost> = {};

  if (changes.title !== undefined) set.title = requireText(changes.title, "title");
  if (changes.body !== undefined) set.body = requireText(changes.body, "body");
  if (changes.hashtags !== undefined) set.hashtags = normalizeHashtags(changes.hashtags);
  if (changes.status !== undefined) set.status = parseStatus(changes.status);
  if (changes.author !== undefined) set.author = requireText(changes.author, "author");

  if (Object.keys(set).length === 0) {
    throw new Error("Nessun campo da aggiornare");
  }

  return getCollection<IPost>(COLLECTION).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: set },
    { returnDocument: "after" },
  );
}

/** DELETE: restituisce true se il post è stato eliminato. */
export async function deletePost(id: string): Promise<boolean> {
  await connectDB()
  
  const result = await getCollection<IPost>(COLLECTION).deleteOne({
    _id: toObjectId(id),
  });
  return result.deletedCount === 1;
}