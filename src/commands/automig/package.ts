import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { readLoadConfig, readUploadInputs } from '../../loadenv';
import { createPackageVersion } from '../../package2';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-migration-automatic', 'package');

export default class Package extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static get usage() {
    return SfdxCommand.usage.replace('<%= command.id %>', 'automig:package');
  }

  public static examples = [
    '$ sfdx automig:package --targetdevhubusername devhub@example.com --inputdir ./data',
    '$ sfdx automig:package --targetdevhubusername devhub@example.com --inputdir ./data --mappingobjects User:Email,RecordType:DeveloperName',
    '$ sfdx automig:package --targetdevhubusername devhub@example.com --inputdir ./data --packageid 0Hoxx00000000xxXXX --versionnumber 1.1.0.NEXT',
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
    packageid: flags.id({
      description: messages.getMessage('packageIdFlagDescription'),
    }),
    packagename: flags.string({
      char: 'p',
      description: messages.getMessage('packageNameFlagDescription'),
    }),
    versionnumber: flags.string({
      description: messages.getMessage('versionNumberFlagDescription'),
      default: '1.0.0.NEXT',
    }),
    versionname: flags.string({
      description: messages.getMessage('versionNameFlagDescription'),
    }),
    versiondescription: flags.string({
      description: messages.getMessage('versionDescriptionFlagDescription'),
    }),
    installationkey: flags.string({
      char: 'k',
      description: messages.getMessage('installationKeyFlagDescription'),
    }),
    wait: flags.integer({
      char: 'w',
      description: messages.getMessage('waitFlagDescription'),
      default: 10,
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  protected static requiresDevhubUsername = true;

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

    // Setup connection to Dev Hub
    if (!this.hubOrg) {
      throw new Error('No Dev Hub organization found');
    }
    const conn = this.hubOrg.getConnection();
    const defaultNamespace: string | undefined = this.flags.defaultnamespace;
    this.ux.startSpinner('Creating Unlocked Package Version');
    const res = await createPackageVersion(
      conn,
      {
        packageId: this.flags.packageid,
        packageName: this.flags.packagename,
        versionNumber: this.flags.versionnumber,
        versionName: this.flags.versionname,
        versionDescription: this.flags.versiondescription,
        installationKey: this.flags.installationkey,
        timeout: this.flags.wait * 60 * 1000,
        build: {
          inputs,
          mappings: config.mappings,
          options: { defaultNamespace },
        },
      },
      (message) => this.ux.setSpinnerStatus(message),
    );
    this.ux.stopSpinner();
    this.ux.log();
    this.ux.log(`Package ID: ${res.packageId}`);
    this.ux.log(`Package Name: ${res.packageName}`);
    this.ux.log(`Package Version ID: ${res.packageVersionId}`);
    this.ux.log(
      `Subscriber Package Version ID: ${res.subscriberPackageVersionId}`,
    );
    this.ux.log(`Version Number: ${res.versionNumber}`);
    this.ux.log(`Install URL: ${res.installUrl}`);
    return res;
  }
}
