import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson} from '@salesforce/ts-types';
import {readFile, readdir} from 'fs-extra';
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
  '$ sfdx automig:load --targetusername username@example.com --dir ./data --mappingobjects User:Email,RecordType:DeveloperName',
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    inputdir: flags.string({char: 'd', description: messages.getMessage('inputDirFlagDescription'), required: true }),
    mappingobjects: flags.array({char: 'm', description: messages.getMessage('mappingObjectsFlagDescription')}),
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
    const am = new AutoMigrator(conn);

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
    am.on('loadProgress', ({ totalCount, successCount, failureCount }) => {
      this.ux.log(`total records: ${totalCount}`);
      this.ux.log(`successes: ${successCount}`);
      this.ux.log(`failures: ${failureCount}`);
    });
    const status = await am.loadCSVData(inputs);
    this.ux.log(`total records: ${status.totalCount}`);
    this.ux.log(`successes: ${status.successes.length}`);
    this.ux.log(`failures: ${status.failures.length}`);
    return status;
  }
}
