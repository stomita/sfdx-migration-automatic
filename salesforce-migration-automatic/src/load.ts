import { Connection, Record as SFRecord } from "jsforce";
import parse from "csv-parse";
import {
  UploadInput,
  UploadResult,
  UploadStatus,
  UploadProgress,
  RecordMappingPolicy
} from "./types";
import { describeSObjects, Describer } from "./describe";

type RecordIdPair = {
  id: string;
  record: Record<string, any>;
};

type LoadDataset = {
  object: string;
  headers: string[];
  rows: string[][];
};

function hasTargets(targetIds: Record<string, boolean>) {
  return Object.keys(targetIds).length > 0;
}

function filterUploadableRecords(
  { object, headers, rows }: LoadDataset,
  targetIds: Record<string, boolean>,
  idMap: Record<string, string>,
  describer: Describer
) {
  // search id and reference id column index
  let idIndex: number | undefined = undefined;
  let refFields: Array<{ field: string; index: number }> = [];
  headers.forEach((header, i) => {
    const field = describer.findFieldDescription(object, header);
    if (field) {
      const { type } = field;
      if (type === "id") {
        idIndex = i;
      } else if (type === "reference") {
        const { name: fieldName, referenceTo } = field;
        for (const refObject of referenceTo || []) {
          if (describer.findSObjectDescription(refObject)) {
            refFields.push({ field: fieldName, index: i });
            break;
          }
        }
      }
    }
  });
  if (idIndex == null) {
    throw new Error(`No id type field is listed for: ${object}`);
  }
  const uploadables: string[][] = [];
  const waitings: Array<{
    row: string[];
    id: string;
    blockingField: string | undefined;
    blockingId: string | undefined;
  }> = [];
  const notloadables: string[][] = [];

  for (const row of rows) {
    const id = row[idIndex];
    if (idMap[id]) {
      // already mapped
      notloadables.push(row);
      continue;
    }
    let isUploadable = !hasTargets(targetIds) || targetIds[id];
    let blockingField: string | undefined = undefined;
    let blockingId: string | undefined = undefined;
    for (const refField of refFields) {
      const { index: refIdx, field } = refField;
      const refId = row[refIdx];
      if (refId) {
        if (targetIds[refId]) {
          // if parent record is in targets
          targetIds[id] = true; // child record should be in targets, too.
        } else if (targetIds[id]) {
          // if child record is in targets
          targetIds[refId] = true; // parent record should be in targets, too.
        }
        if (!idMap[refId]) {
          // if parent record not uploaded
          isUploadable = false;
          blockingField = field;
          blockingId = refId;
        }
      }
    }
    if (isUploadable) {
      uploadables.push(row);
    } else {
      waitings.push({ row, id, blockingField, blockingId });
    }
  }
  return { uploadables, waitings, notloadables };
}

function convertToRecordIdPair(
  { object, headers }: LoadDataset,
  row: string[],
  idMap: Record<string, string>,
  describer: Describer
) {
  let id: string | undefined;
  const record: Record<string, any> = {};
  row.forEach((value, i) => {
    const field = describer.findFieldDescription(object, headers[i]);
    if (field == null) {
      return;
    }
    const { name, type, createable } = field;
    switch (type) {
      case "id":
        id = value;
        break;
      case "int":
        {
          const num = parseInt(value);
          if (!isNaN(num) && createable) {
            record[name] = num;
          }
        }
        break;
      case "double":
      case "currency":
      case "percent":
        {
          const fnum = parseFloat(value);
          if (!isNaN(fnum) && createable) {
            record[name] = fnum;
          }
        }
        break;
      case "date":
      case "datetime":
        if (value && createable) {
          record[name] = value;
        }
        break;
      case "boolean":
        if (createable) {
          record[name] = !/^(|0|n|f|false)$/i.test(value);
        }
        break;
      case "reference":
        if (createable) {
          record[name] = idMap[value];
        }
        break;
      default:
        if (createable) {
          record[name] = value;
        }
        break;
    }
  });
  if (!id) {
    throw new Error(`No id type field is found: ${object}, ${row.join(", ")}`);
  }
  return { id, record };
}

async function uploadRecords(
  conn: Connection,
  uploadings: Record<string, RecordIdPair[]>,
  idMap: Record<string, string>,
  describer: Describer
) {
  const successes: UploadStatus["successes"] = [];
  const failures: UploadStatus["failures"] = [];
  for (const [object, recordIdPairs] of Object.entries(uploadings)) {
    const description = describer.findSObjectDescription(object);
    if (!description) {
      throw new Error(`No object description found: ${object}`);
    }
    const records = recordIdPairs.map(({ record }) => record);
    const rets = await conn
      .sobject(description.name)
      .create(records, { allowRecursive: true } as any);
    if (Array.isArray(rets)) {
      rets.forEach((ret, i) => {
        const record = records[i];
        const origId = recordIdPairs[i].id;
        if (ret.success) {
          // register map info of oldid -> newid
          idMap[origId] = ret.id;
          successes.push({ object, origId, newId: ret.id, record });
        } else {
          failures.push({ object, origId, errors: ret.errors, record });
        }
      });
    }
  }
  return { successes, failures };
}

function calcTotalUploadCount(datasets: LoadDataset[]) {
  let totalCount = 0;
  for (const dataset of datasets) {
    if (dataset) {
      totalCount += dataset.rows.length;
    }
  }
  return totalCount;
}

async function uploadDatasets(
  conn: Connection,
  datasets: LoadDataset[],
  targetIds: Record<string, boolean>,
  idMap: Record<string, string>,
  describer: Describer,
  uploadStatus: UploadStatus,
  reportProgress: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // array of sobj and recordId (old) pair
  const uploadings: Record<string, RecordIdPair[]> = {};
  const blocked: UploadStatus["blocked"] = [];
  for (const dataset of datasets) {
    const { uploadables, waitings } = filterUploadableRecords(
      dataset,
      targetIds,
      idMap,
      describer
    );
    const uploadRecordIdPairs = uploadables.map(row =>
      convertToRecordIdPair(dataset, row, idMap, describer)
    );
    if (uploadRecordIdPairs.length > 0) {
      uploadings[dataset.object] = uploadRecordIdPairs;
    }
    dataset.rows = waitings.map(({ row }) => row);
    blocked.push(
      ...waitings.map(({ id, blockingField, blockingId }) => ({
        object: dataset.object,
        origId: id,
        blockingField,
        blockingId
      }))
    );
  }
  if (Object.keys(uploadings).length > 0) {
    const { successes, failures } = await uploadRecords(
      conn,
      uploadings,
      idMap,
      describer
    );
    const totalCount = uploadStatus.totalCount;
    // event notification;
    const newUploadStatus = {
      totalCount,
      successes: [...uploadStatus.successes, ...successes],
      failures: [...uploadStatus.failures, ...failures],
      blocked
    };
    const successCount = newUploadStatus.successes.length;
    const failureCount = newUploadStatus.failures.length;
    reportProgress({ totalCount, successCount, failureCount });
    // recursive call
    return uploadDatasets(
      conn,
      datasets,
      targetIds,
      idMap,
      describer,
      newUploadStatus,
      reportProgress
    );
  } else {
    return uploadStatus;
  }
}

/**
 *
 */
async function getExistingIdMap(
  conn: Connection,
  dataset: LoadDataset,
  keyField: string,
  describer: Describer
) {
  const { object, headers, rows } = dataset;
  let idIndex = -1;
  let keyIndex = -1;
  headers.forEach((header, i) => {
    if (header === keyField) {
      keyIndex = i;
      return;
    }
    const field = describer.findFieldDescription(object, header);
    if (field && field.type === "id") {
      idIndex = i;
    }
  });
  if (idIndex < 0 || keyIndex < 0) {
    return {};
  }
  const keyMap = rows.reduce(
    (keyMap, row) => {
      const id = row[idIndex];
      const keyValue = row[keyIndex];
      if (id == null || id === "" || keyValue == null || keyValue === "") {
        return keyMap;
      }
      return { ...keyMap, [keyValue]: id };
    },
    {} as Record<string, string>
  );
  const keyValues = Array.from(new Set(Object.keys(keyMap)));
  const records: SFRecord[] =
    keyValues.length === 0
      ? []
      : await conn.sobject(object).find(
          {
            [keyField]: keyValues
          },
          ["Id", keyField]
        );
  const newKeyMap = records.reduce(
    (newKeyMap, record) => {
      const keyValue: string = record[keyField];
      if (keyValue == null) {
        return newKeyMap;
      }
      return {
        ...newKeyMap,
        [keyValue]: record.Id as string
      };
    },
    {} as Record<string, string>
  );
  return Object.keys(keyMap).reduce(
    (idMap, keyValue) => {
      const id = keyMap[keyValue];
      const newId = newKeyMap[keyValue];
      if (id == null || newId == null) {
        return idMap;
      }
      return {
        ...idMap,
        [id]: newId
      };
    },
    {} as Record<string, string>
  );
}

/**
 *
 */
async function getAllExistingIdMap(
  conn: Connection,
  datasets: LoadDataset[],
  mappingPolicies: RecordMappingPolicy[],
  describer: Describer
) {
  const datasetMap = datasets.reduce(
    (datasetMap, dataset) => ({
      ...datasetMap,
      [dataset.object]: dataset
    }),
    {} as Record<string, LoadDataset>
  );
  const idMap = (await Promise.all(
    mappingPolicies.map(({ object, keyField }) => {
      const dataset = datasetMap[object];
      if (!dataset) {
        throw new Error(`Input is not found for mapping object: ${object}`);
      }
      return getExistingIdMap(conn, dataset, keyField, describer);
    })
  )).reduce(
    (idMap, ids) => ({
      ...idMap,
      ...ids
    }),
    {} as Record<string, string>
  );

  return idMap;
}

/**
 *
 */
async function upload(
  conn: Connection,
  datasets: LoadDataset[],
  mappingPolicies: RecordMappingPolicy[],
  reportProgress: (progress: UploadProgress) => void
) {
  const totalCount = calcTotalUploadCount(datasets);
  const targetIds: Record<string, boolean> = {};
  const objects = datasets.map(({ object }) => object);
  const descriptions = await describeSObjects(conn, objects);
  const idMap = await getAllExistingIdMap(
    conn,
    datasets,
    mappingPolicies,
    descriptions
  );
  const uploadStatus = {
    totalCount,
    successes: [],
    failures: [],
    blocked: []
  };
  return uploadDatasets(
    conn,
    datasets,
    targetIds,
    idMap,
    descriptions,
    uploadStatus,
    reportProgress
  );
}

async function parseCSVInputs(inputs: UploadInput[], options: Object) {
  return Promise.all(
    inputs.map(async input => {
      const { object, csvData } = input;
      const [headers, ...rows] = await new Promise<string[][]>(
        (resolve, reject) => {
          parse(
            csvData,
            options,
            (err: Error | undefined, rets: string[][]) => {
              if (err) {
                reject(err);
              } else {
                resolve(rets);
              }
            }
          );
        }
      );
      return { object, headers, rows };
    })
  );
}

/**
 * Load CSV text data in memory in order to upload to Salesforce
 */
export async function loadCSVData(
  conn: Connection,
  inputs: UploadInput[],
  mappingPolicies: RecordMappingPolicy[],
  reportUpload: (status: UploadProgress) => void,
  options: Object = {}
) {
  const datasets = await parseCSVInputs(inputs, options);
  return upload(conn, datasets, mappingPolicies, reportUpload);
}
