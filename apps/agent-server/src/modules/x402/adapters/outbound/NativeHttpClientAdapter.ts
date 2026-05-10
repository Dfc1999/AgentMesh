import type {
  HttpRequestLike,
  HttpResponseLike,
  IHttpClient,
} from "../../ports/outbound/IHttpClient";

export class NativeHttpClientAdapter implements IHttpClient {
  async request(input: HttpRequestLike): Promise<HttpResponseLike> {
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const headers: Record<string, string | undefined> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      body: await response.text(),
    };
  }
}
