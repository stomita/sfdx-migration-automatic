import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { readFile, outputFile, existsSync } from 'fs-extra';
import { Connection } from 'jsforce';
import { AutoMigrator } from 'salesforce-migration-automatic';
import { readLoadConfig, readUploadInputs } from '../../loadenv';
import {
  convertMapToObjectLiteral,
  convertObjectLiteralToMap,
} from '../../util';

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
    config: flags.filepath({
      char: 'f',
      description: messages.getMessage('configFlagDescription'),
    }),
    inputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('inputDirFlagDescription'),
    }),
    targetobjects: flags.array({
      description: messages.getMessage('targetObjectsFlagDescription'),
    }),
    ignoreobjects: flags.array({
      description: messages.getMessage('ignoreObjectsFlagDescription'),
    }),
    mappingobjects: flags.array({
      char: 'm',
      description: messages.getMessage('mappingObjectsFlagDescription'),
      map: (value: string) => {
        const [object, keyField = 'Name'] = value.split(':');
        return { object, keyField };
      },
    }),
    ignorefields: flags.array({
      description: messages.getMessage('ignoreFieldsFlagDescription'),
    }),
    defaultnamespace: flags.string({
      char: 'n',
      description: messages.getMessage('defaultNamespaceFlagDescription'),
    }),
    deletebeforeload: flags.boolean({
      description: messages.getMessage('deleteBeforeLoadFlagDescription'),
    }),
    idmap: flags.filepath({
      char: 'i',
      description: messages.getMessage('idMapFlagDescription'),
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
    // Read configuration file
    const config = await readLoadConfig(this.flags);
    this.logger.debug('Config =>', config);

    // Read uploading inputs
    const inputs = await readUploadInputs(config, this.flags);

    // Setup connection
    if (!this.org) {
      throw new Error('No connecting organization found');
    }
    const conn = this.org.getConnection();
    await conn.request('/');
    const { accessToken, instanceUrl } = conn;
    const defaultNamespace: string | undefined = this.flags.defaultnamespace;
    const conn2 = new Connection({
      accessToken,
      instanceUrl,
      version: this.flags.apiversion,
      callOptions: defaultNamespace ? { defaultNamespace } : undefined,
    });
    conn2.bulk.pollInterval = 10000;
    conn2.bulk.pollTimeout = 600000;
    const am = new AutoMigrator(conn2);

    // Delete existing records
    if (this.flags.deletebeforeload) {
      this.ux.startSpinner('Deleting existing records');
      for (let i = 0; i < 5; i++) {
        await Promise.all(
          inputs
            .filter(
              ({ object }) =>
                !config.mappings?.find((mapping) => mapping.object === object),
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

    // Read id map from file
    let idMap: Map<string, string> | undefined = undefined;
    if (config.idMapFile && existsSync(config.idMapFile)) {
      const idMapJson = await readFile(config.idMapFile, 'utf8');
      idMap = convertObjectLiteralToMap(
        JSON.parse(idMapJson) as { [k: string]: string },
      );
    }

    // Start loading
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
    const status = await am.loadCSVData(inputs, config.mappings, {
      defaultNamespace,
      idMap,
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

    // Write id map to file
    const idMapObj = convertMapToObjectLiteral(status.idMap);
    if (config.idMapFile) {
      await outputFile(config.idMapFile, JSON.stringify(idMapObj, null, 2));
    }

    return { ...status, idMap: idMapObj };
  }
}
