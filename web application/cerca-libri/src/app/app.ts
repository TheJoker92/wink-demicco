import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

interface Volume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    infoLink?: string;
    imageLinks?: { thumbnail?: string };
  };
}
interface VolumesResponse { totalItems: number; items?: Volume[]; }

const API = 'https://www.googleapis.com/books/v1/volumes';
const PAGE = 20;

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  template: `
    <header class="top">
      <h1>Cerca libri</h1>
      <div class="search">
        <input type="search" [formControl]="query" placeholder="Titolo, autore o argomento"
               aria-label="Cerca libri" autofocus />
      </div>
    </header>

    <main>
      @if (error()) {
        <p class="msg error" role="alert">{{ error() }}</p>
      } @else if (loading() && !books().length) {
        <p class="msg">Ricerca in corso…</p>
      } @else if (!searched()) {
        <p class="msg">Scrivi almeno due lettere per cercare tra i libri di Google Libri.</p>
      } @else if (!books().length) {
        <p class="msg">Nessun risultato per “{{ term }}”. Prova con altre parole.</p>
      } @else {
        <p class="count">{{ total() }} risultati per “{{ term }}”</p>
        <ul class="grid">
          @for (b of books(); track b.id) {
            <li class="card">
              <a [href]="b.volumeInfo.infoLink" target="_blank" rel="noopener">
                @if (b.volumeInfo.imageLinks?.thumbnail; as img) {
                  <img [src]="secure(img)" [alt]="'Copertina di ' + b.volumeInfo.title" loading="lazy" />
                } @else {
                  <div class="nocover">Nessuna copertina</div>
                }
                <h2>{{ b.volumeInfo.title }}</h2>
              </a>
              <p class="meta">
                {{ b.volumeInfo.authors?.join(', ') || 'Autore sconosciuto' }}
                @if (b.volumeInfo.publishedDate) { <span>({{ b.volumeInfo.publishedDate.slice(0, 4) }})</span> }
              </p>
            </li>
          }
        </ul>
        @if (books().length < total()) {
          <button class="more" (click)="loadMore()" [disabled]="loading()">
            {{ loading() ? 'Caricamento…' : 'Mostra altri libri' }}
          </button>
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #eef2f5; color: #14212b;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
    .top { position: sticky; top: 0; z-index: 1; background: #14323f; color: #fff;
           padding: 1rem clamp(1rem, 4vw, 3rem); display: flex; flex-wrap: wrap;
           align-items: center; gap: .75rem 2rem; }
    h1 { margin: 0; font-size: 1.4rem; font-weight: 700; }
    .search { flex: 1 1 280px; max-width: 640px; }
    input { width: 100%; box-sizing: border-box; font: inherit; padding: .75rem 1rem;
            border: 2px solid transparent; border-radius: 8px; background: #fff; color: inherit; }
    input:focus-visible, a:focus-visible, button:focus-visible { outline: 3px solid #f2b33d; outline-offset: 2px; }
    main { padding: 1.5rem clamp(1rem, 4vw, 3rem) 3rem; max-width: 1400px; margin: 0 auto; }
    .msg, .count { color: #4a5b66; margin: 1rem 0; }
    .error { color: #a42a1d; font-weight: 600; }
    .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 1.25rem;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    @media (min-width: 700px) { .grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); } }
    .card { background: #fff; border-radius: 8px; padding: .75rem; display: flex; flex-direction: column; gap: .4rem;
            box-shadow: 0 1px 2px rgba(20, 50, 63, .12); }
    .card a { color: inherit; text-decoration: none; display: flex; flex-direction: column; gap: .6rem; }
    .card a:hover h2 { text-decoration: underline; }
    img, .nocover { width: 100%; aspect-ratio: 2 / 3; object-fit: contain; background: #e3e9ed; border-radius: 4px; }
    .nocover { display: grid; place-items: center; color: #6a7a85; font-size: .85rem; }
    h2 { margin: 0; font-size: 1rem; line-height: 1.3; }
    .meta { margin: 0; font-size: .85rem; color: #4a5b66; }
    .more { display: block; margin: 2rem auto 0; font: inherit; font-weight: 600; padding: .75rem 1.5rem;
            border: 0; border-radius: 8px; background: #14323f; color: #fff; cursor: pointer; }
    .more:disabled { opacity: .6; cursor: wait; }
  `,
})
export class App {
  private http = inject(HttpClient);

  query = new FormControl('', { nonNullable: true });
  books = signal<Volume[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  searched = signal(false);
  term = '';

  constructor() {
    this.query.valueChanges
      .pipe(
        debounceTime(400),
        map((q) => q.trim()),
        distinctUntilChanged(),
        tap((q) => {
          this.term = q;
          this.error.set('');
          this.books.set([]);
          this.total.set(0);
          this.searched.set(false);
          this.loading.set(q.length >= 2);
        }),
        switchMap((q) =>
          q.length < 2
            ? of(null)
            : this.fetch(q, 0).pipe(
                catchError(() => {
                  this.error.set('Impossibile contattare Google Libri. Riprova tra poco.');
                  return of(null);
                }),
              ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res) this.apply(res, false);
      });
  }

  loadMore() {
    this.loading.set(true);
    this.fetch(this.term, this.books().length).subscribe({
      next: (res) => { this.loading.set(false); this.apply(res, true); },
      error: () => { this.loading.set(false); this.error.set('Errore nel caricamento di altri libri.'); },
    });
  }

  secure(url: string) { return url.replace(/^http:/, 'https:'); }

  private fetch(q: string, startIndex: number) {
    const params = new HttpParams()
      .set('q', q)
      .set('startIndex', startIndex)
      .set('maxResults', PAGE)
      .set('printType', 'books');
    return this.http.get<VolumesResponse>(API, { params });
  }

  private apply(res: VolumesResponse, append: boolean) {
    const items = res.items ?? [];
    this.books.update((cur) => (append ? [...cur, ...items.filter((i) => !cur.some((c) => c.id === i.id))] : items));
    this.total.set(res.totalItems);
    this.searched.set(true);
  }
}
