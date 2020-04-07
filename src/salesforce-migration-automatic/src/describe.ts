import { Connection, DescribeSObjectResult, Field } from "jsforce";
import { DescribeSObjectResultMap } from "./types";
import { removeNamespace } from "./util";

/**
 *
 */
function findSObjectDescription(
  object: string,
  descriptions: DescribeSObjectResultMap
) {
  const objectLowerCase = object.toLowerCase();
  let description = descriptions[objectLowerCase];
  if (!description) {
    description = descriptions[removeNamespace(objectLowerCase)];
  }
  return description;
}

/**
 *
 */
function findFieldDescription(
  object: string,
  fieldName: string,
  descriptions: DescribeSObjectResultMap
) {
  const description = findSObjectDescription(object, descriptions);
  if (description) {
    const fieldNameLowerCase = fieldName.toLowerCase();
    let field = description.fields.find(
      ({ name }) => name.toLowerCase() === fieldNameLowerCase
    );
    if (!field) {
      const fieldNameNoNamespace = removeNamespace(fieldNameLowerCase);
      field = description.fields.find(
        ({ name }) => name.toLowerCase() === fieldNameNoNamespace
      );
    }
    return field;
  }
}

/**
 *
 */
export interface Describer {
  findSObjectDescription(object: string): DescribeSObjectResult | undefined;
  findFieldDescription(object: string, fieldName: string): Field | undefined;
}

/**
 *
 * @param conn
 * @param objects
 */
export async function describeSObjects(
  conn: Connection,
  objects: string[]
): Promise<Describer> {
  const descriptions = (await Promise.all(
    objects.map(async object =>
      conn
        .describe(object)
        .catch(err => {
          const object2 = removeNamespace(object);
          if (object !== object2) {
            return conn.describe(removeNamespace(object));
          }
          throw err;
        })
        .catch(err => {
          if (err.name === "NOT_FOUND") {
            throw new Error(`No object schema found: ${object}`);
          }
          throw err;
        })
    )
  )).reduce(
    (describedMap, described) => ({
      ...describedMap,
      [described.name.toLowerCase()]: described
    }),
    {} as DescribeSObjectResultMap
  );
  return {
    findSObjectDescription(object: string) {
      return findSObjectDescription(object, descriptions);
    },
    findFieldDescription(object: string, fieldName: string) {
      return findFieldDescription(object, fieldName, descriptions);
    }
  };
}
