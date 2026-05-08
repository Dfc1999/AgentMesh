export interface RedisClientLike {
  ping(): Promise<string>;
}

export function createRedisClientPlaceholder(): RedisClientLike {
  return {
    async ping() {
      return "PONG";
    },
  };
}
