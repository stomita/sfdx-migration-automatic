import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { readdir, readFile } from 'fs-extra';
import { Connection } from 'jsforce';
import * as path from 'path';
import {
  AutoMigrator,
  RecordMappingPolicy,
  UploadInput,
} from 'salesforce-migration-automatic';

/**
 *
 */
function removeNamespace(identifier: string) {
  return identifier.replace(/^[a-zA-Z][a-zA-Z0-9]+__/, '');
}

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfdx-migration-automatic', 'load');

export default class Load extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static get usage() {
    return SfdxCommand.usage.replace('<%= command.id %>', 'automig:load');
  }

  public static examples = [
    '$ sfdx automig:load --targetusername username@example.com --inputdir ./data',
    '$ sfdx automig:load --targetusername username@example.com --inputdir ./data --mappingobjects User:Email,RecordType:DeveloperName',
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    inputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('inputDirFlagDescription'),
      required: true,
    }),
    mappingobjects: flags.array({
      char: 'm',
      description: messages.getMessage('mappingObjectsFlagDescription'),
      map: (value: string) => {
        const [object, keyField = 'Name'] = value.split(':');
        return { object, keyField };
      },
    }),
    defaultnamespace: flags.string({
      char: 'n',
      description: messages.getMessage('defaultNamespaceFlagDescription'),
    }),
    deletebeforeload: flags.boolean({
      description: messages.getMessage('deleteBeforeLoadFlagDescription'),
    }),
    verbose: flags.builtin(),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  /**
   *
   */
  public async run(): Promise<AnyJson> {
    const inputDir: string | undefined = this.flags.inputdir;
    if (!inputDir) {
      throw new Error(
        'No --inputdir options found, specify directory with CSV files',
      );
    }
    const defaultNamespace: string | undefined = this.flags.defaultnamespace;

    const conn = this.org.getConnection();
    await conn.request('/');
    const { accessToken, instanceUrl } = conn;
    const conn2 = new Connection({
      accessToken,
      instanceUrl,
      version: this.flags.apiversion,
      callOptions: defaultNamespace ? { defaultNamespace } : undefined,
    });
    conn2.bulk.pollInterval = 10000;
    conn2.bulk.pollTimeout = 600000;
    const am = new AutoMigrator(conn2);

    const filenames = await readdir(inputDir);
    const inputs: UploadInput[] = [];
    for (const filename of filenames) {
      const ext = path.extname(filename);
      if (ext === '.csv') {
        const object = filename.substring(0, filename.length - ext.length);
        const filepath = path.join(inputDir, filename);
        let csvData = await readFile(filepath, 'utf8');
        if (csvData[0] === '\ufeff') {
          // Byte order mark
          csvData = csvData.substring(1);
        }
        inputs.push({ object, csvData });
      }
    }
    const mappingPolicies: RecordMappingPolicy[] =
      this.flags.mappingobjects || [];
    if (this.flags.deletebeforeload) {
      this.ux.startSpinner('Deleting existing records');
      for (let i = 0; i < 5; i++) {
        await Promise.all(
          inputs
            .filter(
              ({ object }) =>
                !mappingPolicies.find((mapping) => mapping.object === object),
            )
            .map(async ({ object }) => {
              await conn2
                .sobject(object)
                .find({}, 'Id')
                .destroy()
                .catch((err) => {
                  const object2 = removeNamespace(object);
                  if (object2 !== object) {
                    return conn2.sobject(object2).find({}, 'Id').destroy();
                  }
                  throw err;
                });
            }),
        );
      }
      this.ux.stopSpinner();
    }
    let loading = false;
    am.on('loadProgress', ({ totalCount, successCount, failureCount }) => {
      const message = `successes: ${successCount}, failures: ${failureCount}`;
      this.ux.setSpinnerStatus(message);
      if (!loading) {
        this.ux.log(`Total records in input: ${totalCount}`);
        loading = true;
      }
    });
    this.ux.startSpinner('Loading records');
    const status = await am.loadCSVData(inputs, mappingPolicies, {
      defaultNamespace,
    });
    this.ux.stopSpinner();
    this.ux.log();
    this.ux.log(`Successes: ${status.successes.length}`);
    this.ux.log(`Failures: ${status.failures.length}`);
    this.logger.debug('successes =>');
    for (const success of status.successes) {
      this.logger.debug(success.object, success.origId, success.newId);
    }
    if (this.flags.verbose) {
      this.ux.log();
      this.ux.log('Success Results:');
      this.ux.log();
      this.ux.table(status.successes, {
        columns: [
          {
            key: 'object',
            label: 'Object',
          },
          {
            key: 'origId',
            label: 'Original ID',
          },
          {
            key: 'newId',
            label: 'New ID',
          },
        ],
      });
    }
    if (status.failures.length > 0) {
      this.logger.debug('failures =>');
      for (const failure of status.failures) {
        this.logger.debug(
          failure.object,
          failure.origId,
          failure.record,
          failure.errors.map((e) => e.message),
        );
      }
      this.ux.log();
      this.ux.log('Failure Results:');
      this.ux.log();
      this.ux.table(
        status.failures.map((failure) => {
          return {
            object: failure.object,
            origId: failure.origId,
            error: failure.errors.map((e) => e.message).join('\n'),
          };
        }),
        {
          columns: [
            {
              key: 'object',
              label: 'Object',
            },
            {
              key: 'origId',
              label: 'Original ID',
            },
            {
              key: 'error',
              label: 'Error Message',
            },
          ],
        },
      );
    }
    if (status.blocked.length > 0) {
      this.logger.debug('failures =>');
      for (const block of status.blocked) {
        this.logger.debug(
          block.object,
          block.origId,
          block.blockingField,
          block.blockingId,
        );
      }
      this.ux.log();
      this.ux.log('Blocked Inputs:');
      this.ux.log();
      this.ux.table(status.blocked, {
        columns: [
          {
            key: 'object',
            label: 'Object',
          },
          {
            key: 'origId',
            label: 'Original ID',
          },
          {
            key: 'blockingField',
            label: 'Blocking Reference',
          },
          {
            key: 'blockingId',
            label: 'Reference ID',
          },
        ],
      });
    }
    return { ...status, idMap: convertMapToObjectLiteral(status.idMap) };
  }
}

function convertMapToObjectLiteral<V>(map: Map<string, V>) {
  return [...map].reduce(
    (obj, [key, value]) => ({
      ...obj,
      [key]: value,
    }),
    {},
  );
}
