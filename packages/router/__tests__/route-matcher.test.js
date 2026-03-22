import { describe, it, expect } from 'vitest';
import { matchRoute } from '../src/route-matcher.js';
describe('matchRoute', () => {
    it('matches an exact path', () => {
        const result = matchRoute([{ path: '/home' }], '/home');
        expect(result).not.toBeNull();
        expect(result?.params).toEqual({});
        expect(result?.config.path).toBe('/home');
    });
    it('returns null when path does not match', () => {
        expect(matchRoute([{ path: '/home' }], '/about')).toBeNull();
    });
    it('returns null when segment count differs', () => {
        expect(matchRoute([{ path: '/users/:id' }], '/users')).toBeNull();
        expect(matchRoute([{ path: '/users' }], '/users/42')).toBeNull();
    });
    it('extracts a single named param', () => {
        const result = matchRoute([{ path: '/users/:id' }], '/users/42');
        expect(result?.params).toEqual({ id: '42' });
    });
    it('extracts multiple named params', () => {
        const result = matchRoute([{ path: '/posts/:year/:month' }], '/posts/2024/03');
        expect(result?.params).toEqual({ year: '2024', month: '03' });
    });
    it('URL-decodes param values', () => {
        const result = matchRoute([{ path: '/search/:query' }], '/search/hello%20world');
        expect(result?.params).toEqual({ query: 'hello world' });
    });
    it('matches the global wildcard ** against any path', () => {
        const result = matchRoute([{ path: '**' }], '/any/nested/path');
        expect(result).not.toBeNull();
        expect(result?.params).toEqual({});
    });
    it('matches a trailing ** wildcard segment', () => {
        const result = matchRoute([{ path: '/files/**' }], '/files/a/b/c');
        expect(result).not.toBeNull();
    });
    it('returns null for trailing ** when prefix does not match', () => {
        expect(matchRoute([{ path: '/files/**' }], '/docs/a/b')).toBeNull();
    });
    it('returns the first matching route (not the best match)', () => {
        const routes = [
            { path: '/users/:id' },
            { path: '/users/profile' },
        ];
        // '/users/profile' satisfies ':id' first — that is intentional first-match behaviour
        const result = matchRoute(routes, '/users/profile');
        expect(result?.config.path).toBe('/users/:id');
        expect(result?.params).toEqual({ id: 'profile' });
    });
    it('matches the root path /', () => {
        const result = matchRoute([{ path: '/' }], '/');
        expect(result).not.toBeNull();
    });
    it('returns null when the route list is empty', () => {
        expect(matchRoute([], '/home')).toBeNull();
    });
});
//# sourceMappingURL=route-matcher.test.js.map