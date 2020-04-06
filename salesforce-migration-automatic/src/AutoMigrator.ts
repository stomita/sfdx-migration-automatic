import { EventEmitter } from "events";
import { Connection } from "jsforce";
import { UploadInput, RecordMappingPolicy, DumpQuery } from "./types";
import { loadCSVData } from "./load";
import { dumpAsCSVData } from "./dump";

/*
 * Import other org data, exported from salesforce.com (via DataLoader) This
 * class automatically resolves inter-record dependencies.
 */
export class AutoMigrator extends EventEmitter {
  private _conn: Connection;

  constructor(conn: Connection) {
    super();
    this._conn = conn;
  }

  /**
   * Load CSV text data in memory in order to upload to Salesforce
   *
   */
  async loadCSVData(
    inputs: UploadInput[],
    mappingPolicies: RecordMappingPolicy[] = [],
    options: Object = {}
  ) {
    const conn = this._conn;
    return loadCSVData(
      conn,
      inputs,
      mappingPolicies,
      params => {
        this.emit("loadProgress", params);
      },
      options
    );
  }

  /**
   * Dump the record data as CSV
   * @param queries
   */
  async dumpAsCSVData(queries: DumpQuery[]) {
    const conn = this._conn;
    return dumpAsCSVData(conn, queries, params => {
      this.emit("dumpProgress", params);
    });
  }
}
