/**
 *
 */
export function removeNamespace(identifier: string) {
  return identifier.replace(/^[a-zA-Z][a-zA-Z0-9]+__/, "");
}
