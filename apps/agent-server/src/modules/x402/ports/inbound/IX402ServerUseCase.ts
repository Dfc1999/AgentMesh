import type {
  X402ProtectedResource,
  X402ServerRequest,
  X402ServerResult,
} from "../../domain/types";

export interface IX402ServerUseCase {
  protect(request: X402ServerRequest, resource: X402ProtectedResource): Promise<X402ServerResult>;
}
