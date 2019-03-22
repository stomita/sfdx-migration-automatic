import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson} from '@salesforce/ts-types';
import {readdir, readFile} from 'fs-extra';
import {Connection} from 'jsforce';
import * as path from 'path';
import {AutoMigrator, UploadInput} from 'salesforce-migration-automatic';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfdx-migration-automatic', 'load');

export default class Load extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ sfdx automig:load --targetusername username@example.com --dir ./data',
  '$ sfdx automig:load --targetusername username@example.com --dir ./data --mappingobjects User:Email,RecordType:DeveloperName'
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    inputdir: flags.string({char: 'd', description: messages.getMessage('inputDirFlagDescription'), required: true }),
    mappingobjects: flags.array({char: 'm', description: messages.getMessage('mappingObjectsFlagDescription')}),
    deletebeforeload: flags.boolean({description: messages.getMessage('deleteBeforeLoadFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    const inputDir = this.flags.inputdir;
    if (!inputDir) {
      throw new Error('No --inputdir options found, specify directory with CSV files');
    }

    const conn = this.org.getConnection();
    await conn.request('/');
    const { accessToken, instanceUrl } = conn;
    const conn2 = new Connection({ accessToken, instanceUrl });
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
        const csvData = await readFile(filepath, 'utf8');
        inputs.push({ object, csvData });
      }
    }
    const mappingPolicies =
      (this.flags.mappingobjects || []).map(name => {
        const [object, keyField] = name.split(':');
        return { object, keyField };
      });
    if (this.flags.deletebeforeload) {
      this.ux.startSpinner('deleting existing records');
      for (let i = 0; i < 3; i++) {
        await Promise.all(
          inputs.filter(({ object }) =>
            !mappingPolicies.find(mapping => mapping.object === object)
          ).map(({ object }) => conn2.sobject(object).find().destroy())
        );
      }
      this.ux.stopSpinner();
    }
    am.on('loadProgress', ({ totalCount, successCount, failureCount }) => {
      const message = `total loading records: ${totalCount} (successes: ${successCount}, failures: ${failureCount})`;
      this.ux.setSpinnerStatus(message);
    });
    this.ux.startSpinner('loading records');
    const status = await am.loadCSVData(inputs, mappingPolicies);
    this.ux.stopSpinner();
    this.ux.log(`total records: ${status.totalCount}`);
    this.ux.log(`successes: ${status.successes.length}`);
    this.ux.log(`failures: ${status.failures.length}`);
    for (const failure of status.failures) {
      this.ux.log(`${failure.object}:${failure.origId}: `);
      this.ux.log(failure.record);
      for (const error of failure.errors) {
        this.ux.log(`   - ${error.message}`);
      }
    }
    return status;
  }
}
