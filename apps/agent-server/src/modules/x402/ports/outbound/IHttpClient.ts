import type { X402HttpMethod } from "../../domain/types";

export interface HttpResponseLike {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
}

export interface HttpRequestLike {
  url: string;
  method: X402HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
}

export interface IHttpClient {
  request(input: HttpRequestLike): Promise<HttpResponseLike>;
}
