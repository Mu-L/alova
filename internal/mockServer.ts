import { DefaultBodyType, delay, http, HttpResponse, StrictRequest } from 'msw';
import { setupServer } from 'msw/node';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const baseURL = 'http://localhost:3000';
const countMap = {} as Record<string, number>;
const mockServer = setupServer(
  http.get(baseURL + '/unit-test', async ({ request }) => result(200, request)),
  http.get(baseURL + '/unit-test-1s', async ({ request }) => {
    await delay(900);
    return result(200, request);
  }),
  http.get(baseURL + '/unit-test-count', ({ request }) => {
    const urlObj = new URL(request.url);
    const key = (urlObj.searchParams.get('countKey') || '') as string;
    countMap[key] = countMap[key] || 0;
    return result(200, request, false, { count: countMap[key]++ });
  }),
  http.get(baseURL + '/unit-test-404', () => {
    return new HttpResponse(null, {
      status: 404,
      statusText: 'api not found'
    });
  }),
  http.get(baseURL + '/unit-test-error', () => HttpResponse.error()),
  http.post(baseURL + '/unit-test', ({ request }) => result(200, request, true)),
  http.delete(baseURL + '/unit-test', ({ request }) => result(200, request, true)),
  http.put(baseURL + '/unit-test', ({ request }) => result(200, request, true)),
  http.head(baseURL + '/unit-test', () => HttpResponse.json({})),
  http.patch(baseURL + '/unit-test', ({ request }) => result(200, request, true)),
  http.options(baseURL + '/unit-test', () => HttpResponse.json({})),
  http.get(baseURL + '/unit-test-download', async () => {
    await delay(200);
    // Read the image from the file system using the "fs" module.
    const imageBuffer = readFileSync(path.resolve(__dirname, './image.jpg'));
    return new HttpResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.byteLength.toString()
      }
    });
  }),
  http.post(baseURL + '/unit-test-headers', ({ request }) => {
    return HttpResponse.json({
      code: 200,
      msg: '',
      data: {
        requestHeaders: Object.fromEntries(request.headers.entries())
      }
    });
  })
);

export default mockServer;

// -------------------
// 服务模拟
async function result(code: number, req: StrictRequest<DefaultBodyType>, hasBody = false, extraParams = {}) {
  await delay(10);
  const urlObj = new URL(req.url);
  const data: Record<string, any> = {
    path: urlObj.pathname,
    method: req.method,
    params: {
      ...Object.fromEntries(urlObj.searchParams.entries()),
      ...extraParams
    }
  };
  if (hasBody) {
    try {
      data.data = await req.clone().json();
    } catch (error) {
      try {
        const formData = Object.fromEntries((await req.clone().formData()).entries());
        data.data = formData;
      } catch (error) {
        data.data = await (await req.blob()).text();
      }
    }
  }
  return HttpResponse.json({
    code,
    msg: '',
    data
  });
}
