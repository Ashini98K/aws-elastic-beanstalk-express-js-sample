const request = require('supertest');
const app = require('../app');

describe('GET /', () => {
  it('responds 200 with the greeting', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Hello World!');
  });

  it('serves HTML-safe plain text', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });
});

describe('unknown routes', () => {
  it('returns 404 rather than leaking a stack trace', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.statusCode).toBe(404);
    expect(res.text).not.toMatch(/at .*\(/); // no stack frames in the body
  });
});
