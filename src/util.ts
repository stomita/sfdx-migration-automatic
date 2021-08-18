export function toStringList(v: string | string[]) {
  return typeof v === 'string' ? v.split(/\s*,\s*/) : v;
}

export function convertMapToObjectLiteral<V>(map: Map<string, V>) {
  return [...map].reduce(
    (obj, [key, value]) => ({
      ...obj,
      [key]: value,
    }),
    {},
  );
}

export function convertObjectLiteralToMap<V>(obj: { [key: string]: V }) {
  return new Map(Object.keys(obj).map((key) => [key, obj[key]]));
}

export function asArray<T>(arr: T | T[] | null | undefined): T[] {
  if (arr == null) {
    return [];
  }
  if (Object.prototype.toString.apply(arr) !== '[object Array]') {
    return [arr as T];
  }
  return arr as T[];
}
