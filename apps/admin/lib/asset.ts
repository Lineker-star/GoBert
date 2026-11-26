/** Prefix a /public asset with the secret base path (next/image does not add it). */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
