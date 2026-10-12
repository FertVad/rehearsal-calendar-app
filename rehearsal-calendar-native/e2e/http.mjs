/**
 * A GET whose only limit is the one it is given. Node's fetch gives up when
 * the response headers take more than five minutes, and Metro sends none
 * until a cold bundle is built: under load that took longer, and e2e failed
 * with a bare "fetch failed" before any flow ran (T-304, 2026-10-12).
 */
import http from 'node:http';

export function getText(url, { deadlineMs }) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        clearTimeout(timer);
        if (response.statusCode !== 200) reject(new Error(`${url} answered ${response.statusCode}: ${body.slice(0, 300)}`));
        else resolve(body);
      });
      response.on('error', (error) => { clearTimeout(timer); reject(error); });
    });
    const timer = setTimeout(() => {
      const error = new Error(`${url} gave no complete answer within ${Math.round(deadlineMs / 60000)} min`);
      error.code = 'DEADLINE';
      request.destroy(error);
    }, deadlineMs);
    request.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}
