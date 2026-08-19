import argon2 from "argon2";

const options = { type: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> { return argon2.hash(password, options); }
export function verifyPassword(hash: string, password: string): Promise<boolean> { return argon2.verify(hash, password); }
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword("CambridgeYLE dummy password, never a credential.");
  await verifyPassword(await dummyHash, password);
}
