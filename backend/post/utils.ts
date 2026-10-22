export const STATUSES = ["draft", "published"] as const;

export type PostStatus = (typeof STATUSES)[number];


/** Dati accettati in creazione: solo title e body sono obbligatori. */
export type NewPost = Pick<IPost, "title" | "body"> &
  Partial<Pick<IPost, "hashtags" | "status" | "author">>;

/** Dati accettati in aggiornamento: qualsiasi campo, tutti opzionali. */
export type PostChanges = Partial<IPost>;

export interface PostFilter {
  status?: PostStatus;
  author?: string;
  hashtag?: string;
}


export interface IPost {
  title: string;
  body: string;
  hashtags: string[];
  status: PostStatus;
  author: string;
}