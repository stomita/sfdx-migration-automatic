import { readdir, readFile } from 'fs-extra';
import * as path from 'path';
import { SfdxCommand } from '@salesforce/command';
import {
  RecordMappingPolicy,
  UploadInput,
} from 'salesforce-migration-automatic';
import { toStringList } from './util';

export type LoadConfig = {
  inputDir: string;
  targets?: Omit<UploadInput, 'csvData'>[];
  mappings?: RecordMappingPolicy[];
  idMapFile?: string;
};

export async function readLoadConfig(flags: SfdxCommand['flags']) {
  let config: LoadConfig;
  if (flags.config) {
    const configFileName: string = flags.config;
    const configDir = path.dirname(configFileName);
    const fileData = await readFile(configFileName, 'utf8');
    config = JSON.parse(fileData) as LoadConfig;
    if (flags.inputdir) {
      config.inputDir = flags.inputdir;
    } else if (!path.isAbsolute(config.inputDir)) {
      config.inputDir = path.join(configDir, config.inputDir);
    }
    if (flags.idmap) {
      config.idMapFile = flags.idmap;
    } else if (config.idMapFile && !path.isAbsolute(config.idMapFile)) {
      config.idMapFile = path.join(configDir, config.idMapFile);
    }
  } else if (flags.inputdir) {
    config = {
      inputDir: flags.inputdir || '.',
      mappings: flags.mappingobjects,
      idMapFile: flags.idmap,
    };
  } else {
    throw new Error(
      'No --config or --inputdir options are supplied to command arg',
    );
  }
  return config;
}

export async function readUploadInputs(
  config: LoadConfig,
  flags: SfdxCommand['flags'],
) {
  // Setup target objects from config and command options
  let targetObjects: Map<string, UploadInput> | undefined = config.targets
    ? new Map(
        config.targets.map((target) => [
          target.object,
          { ...target, csvData: '' },
        ]),
      )
    : undefined;
  if (flags.targetobjects) {
    targetObjects = new Map(
      (flags.targetobjects as string[]).map((object) => [
        object,
        {
          object,
          csvData: '',
        },
      ]),
    );
  }
  let ignoreObjects: Set<string> | undefined = undefined;
  if (flags.ignoreobjects) {
    ignoreObjects = new Set(flags.ignoreobjects as string[]);
  }
  const objectIgnoreFields = new Map<string, string[]>();
  if (flags.ignorefields) {
    for (const fieldPath of flags.ignorefields as string[]) {
      const [object, field] = fieldPath.split('.');
      const ignoreFields = [...(objectIgnoreFields.get(object) ?? []), field];
      objectIgnoreFields.set(object, ignoreFields);
    }
  }

  // Read CSV data as upload inputs
  const inputs: UploadInput[] = [];
  const filenames = await readdir(config.inputDir);
  for (const filename of filenames) {
    const ext = path.extname(filename);
    if (ext === '.csv') {
      const object = filename.substring(0, filename.length - ext.length);
      if (
        (!targetObjects || targetObjects.has(object)) &&
        (!ignoreObjects || !ignoreObjects.has(object))
      ) {
        const filepath = path.join(config.inputDir, filename);
        let csvData = await readFile(filepath, 'utf8');
        if (csvData[0] === '\ufeff') {
          // Byte order mark
          csvData = csvData.substring(1);
        }
        const target = targetObjects?.get(object);
        const ignoreFields = objectIgnoreFields.get(object);
        inputs.push({
          object,
          csvData,
          ...target,
          ...(ignoreFields
            ? {
                ignoreFields: [
                  ...toStringList(target?.ignoreFields ?? []),
                  ...ignoreFields,
                ],
              }
            : {}),
        });
      }
    }
  }
  return inputs;
}
