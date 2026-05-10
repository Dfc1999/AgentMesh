import { createHash } from "node:crypto";
import type { X402PaymentPayload, X402PaymentProof } from "./types";

export function encodePayload(payload: X402PaymentPayload): string {
  return Buffer.from(
    JSON.stringify(payload, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ).toString("base64url");
}

export function decodePayload(header: string): X402PaymentPayload {
  const raw = header.trim().startsWith("{")
    ? header
    : Buffer.from(header, "base64url").toString("utf8");
  const parsed = JSON.parse(raw) as Omit<X402PaymentPayload, "amountLamports"> & {
    amountLamports: string | number;
  };

  return {
    ...parsed,
    amountLamports: BigInt(parsed.amountLamports),
  };
}

export function encodeProof(proof: X402PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString("base64url");
}

export function decodeProof(header: string): X402PaymentProof {
  const raw = header.trim().startsWith("{")
    ? header
    : Buffer.from(header, "base64url").toString("utf8");
  return JSON.parse(raw) as X402PaymentProof;
}

export function payloadHash(payload: X402PaymentPayload): string {
  return createHash("sha256").update(encodePayload(payload)).digest("hex");
}
