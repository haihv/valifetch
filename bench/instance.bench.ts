import { bench, describe } from 'vitest';
import { valifetch } from '../src/core/valifetch';

describe('instance', () => {
  bench('create() — no options', () => {
    valifetch.create();
  });

  bench('create() — with prefixUrl + headers', () => {
    valifetch.create({
      prefixUrl: 'https://api.example.com',
      headers: { Authorization: 'Bearer token' },
    });
  });

  bench('extend() — child inherits parent (lazy merge)', () => {
    valifetch.extend({ prefixUrl: 'https://api.example.com' });
  });

  bench('extend() — child with callback (eager merge)', () => {
    valifetch.extend((prev) => ({ ...prev, timeout: 5000 }));
  });

  bench('extend() — nested two levels', () => {
    const child = valifetch.extend({ prefixUrl: 'https://api.example.com' });
    child.extend({ timeout: 5000 });
  });
});
