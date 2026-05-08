export interface PrismaClientLike {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

export function createPrismaClientPlaceholder(): PrismaClientLike {
  return {
    async $connect() {
      return undefined;
    },
    async $disconnect() {
      return undefined;
    },
  };
}
