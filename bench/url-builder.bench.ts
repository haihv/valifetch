import { bench, describe } from 'vitest';
import { buildUrl } from '../src/url/builder';

describe('url-builder (pure sync)', () => {
  bench('absolute URL — no params', () => {
    buildUrl({ path: 'https://api.example.com/users' });
  });

  bench('prefixUrl + path — no params', () => {
    buildUrl({ prefixUrl: 'https://api.example.com', path: '/users' });
  });

  bench('prefixUrl + path param replacement', () => {
    buildUrl({
      prefixUrl: 'https://api.example.com',
      path: '/users/:id/posts/:postId',
      params: { id: '42', postId: '7' },
    });
  });

  bench('prefixUrl + searchParams (record)', () => {
    buildUrl({
      prefixUrl: 'https://api.example.com',
      path: '/search',
      searchParams: { q: 'foo', page: '2', limit: '20' },
    });
  });

  bench('prefixUrl + searchParams (5 params)', () => {
    buildUrl({
      prefixUrl: 'https://api.example.com',
      path: '/search',
      searchParams: { q: 'foo', page: '2', limit: '20', sort: 'asc', filter: 'active' },
    });
  });

  bench('trailing-slash normalisation on prefixUrl', () => {
    buildUrl({ prefixUrl: 'https://api.example.com/', path: '/users' });
  });
});
