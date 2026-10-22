import { Router } from "express";
import type { Request, Response } from "express";
import { MongoError } from "mongodb";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
} from "./service.ts";
import type { PostFilter, PostStatus } from "./utils.ts";

const router = Router();

/** Gestisce gli errori in un punto solo (funziona con Express 4 e 5). */
function handle(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      // Errori del database = 500, errori di validazione = 400
      const status = err instanceof MongoError ? 500 : 400;
      console.error("[posts]", err);
      res.status(status).json({ error: message });
    }
  };
}

// POST /posts  -> crea un post
router.post(
  "/",
  handle(async (req, res) => {
    const post = await createPost(req.body ?? {});
    res.status(201).json(post);
  }),
);

// GET /posts?status=draft&author=Brian%20Fox&hashtag=mongodb  -> lista
router.get(
  "/",
  handle(async (req, res) => {
    const { status, author, hashtag } = req.query;
    const filter: PostFilter = {};
    if (typeof status === "string") filter.status = status as PostStatus;
    if (typeof author === "string") filter.author = author;
    if (typeof hashtag === "string") filter.hashtag = hashtag;

    res.json(await getPosts(filter));
  }),
);

// GET /posts/:id  -> singolo post
router.get(
  "/:id",
  handle(async (req, res) => {
    const post = await getPostById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post non trovato" });
      return;
    }
    res.json(post);
  }),
);

// PATCH /posts/:id  -> aggiorna i campi inviati
router.patch(
  "/:id",
  handle(async (req, res) => {
    const post = await updatePost(req.params.id, req.body ?? {});
    if (!post) {
      res.status(404).json({ error: "Post non trovato" });
      return;
    }
    res.json(post);
  }),
);

// DELETE /posts/:id  -> elimina
router.delete(
  "/:id",
  handle(async (req, res) => {
    const deleted = await deletePost(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Post non trovato" });
      return;
    }
    res.status(204).send();
  }),
);

export default router;