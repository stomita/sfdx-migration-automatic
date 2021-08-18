import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { Connection } from 'jsforce';
import { createPackage } from 'salesforce-migration-app-pack';
import { readLoadConfig, readUploadInputs } from '../../loadenv';
import { asArray } from '../../util';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  'sfdx-migration-automatic',
  'package',
);

export default class Load extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static get usage() {
    return SfdxCommand.usage.replace('<%= command.id %>', 'automig:package');
  }

  public static examples = [
    '$ sfdx automig:package --targetusername username@example.com --inputdir ./data',
    '$ sfdx automig:package --targetusername username@example.com --inputdir ./data --mappingobjects User:Email,RecordType:DeveloperName',
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
    packagename: flags.string({
      char: 'p',
      description: messages.getMessage('packageNameFlagDescription'),
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
    this.ux.startSpinner('Creating Migration App Package');
    const packageName: string | undefined = this.flags.packagename;
    const res = await createPackage(conn2, {
      inputs,
      mappings: config.mappings,
      options: { defaultNamespace },
      packageName,
    });
    this.ux.stopSpinner();
    this.ux.log();
    this.ux.log(`Status: ${res.status}`);
    this.ux.log(`Success: ${res.success}`);
    this.ux.log(`Done: ${res.done}`);
    this.ux.log(`Number Component Errors: ${res.numberComponentErrors}`);
    this.ux.log(`Number Components Deployed: ${res.numberComponentsDeployed}`);
    this.ux.log(`Number Components Total: ${res.numberComponentsTotal}`);
    this.ux.log(`Number Test Errors: ${res.numberTestErrors}`);
    this.ux.log(`Number Tests Completed: ${res.numberTestsCompleted}`);
    this.ux.log(`Number Tests Total: ${res.numberTestsTotal}`);

    if (res.packageInfo?.Id) {
      this.ux.log();
      this.ux.log(`Deployed Package ID: ${res.packageInfo.Id}`);
    }

    const details: any = res.details;
    if (details) {
      this.logger.debug('details =>', details);
      if (this.flags.verbose) {
        this.ux.log();
        const successes = asArray(details.componentFailures);
        if (successes.length > 0) {
          this.ux.log('Successes:');
        }
        for (const s of successes) {
          const flag =
            String(s.changed) === 'true'
              ? '(M)'
              : String(s.created) === 'true'
              ? '(A)'
              : String(s.deleted) === 'true'
              ? '(D)'
              : '(~)';
          this.ux.log(
            ` - ${flag} ${s.fileName}${
              s.componentType ? `[${s.componentType}]` : ''
            }`,
          );
        }
      }
      const failures = asArray(details.componentFailures);
      if (failures && failures.length > 0) {
        this.ux.log();
        this.ux.log('Failures:');
        for (const f of failures) {
          this.ux.log(
            ` - ${f.problemType} on ${f.fileName}${
              typeof f.lineNumber !== 'undefined'
                ? ` (${f.lineNumber}:${f.columnNumber})`
                : ''
            } : ${f.problem}`,
          );
        }
      }
    }
    return res as AnyJson;
  }
}
