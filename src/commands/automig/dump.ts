import fs from 'fs-extra';
import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson} from '@salesforce/ts-types';
import {AutoMigrator} from 'salesforce-migration-automatic';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfdx-migration-automatic', 'dump');

export default class Dump extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx automig:dump --targetusername username@example.com --targetdevhubusername devhub@example.org --objects Opportunity,Case,Account:related,Task:related --outdir ./dump`,
  `$ sfdx automig:dump --targetusername username@example.com --targetdevhubusername devhub@example.org --config automig-dump-config.json`,
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    objects: flags.array({char: 'o', description: messages.getMessage('objectFlagDescription')}),
    config: flags.string({char: 'f', description: messages.getMessage('configFlagDescription')}),
    outdir: flags.string({char: 'd', description: messages.getMessage('outdirFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    // const name = this.flags.name || 'world';

    interface DumpConfig {
      outDir: string,
      targets: Array<any>,
    };

    let config: DumpConfig;
    if (this.flags.configFile) {
      const configFileName: string = this.flags.configFile;
      const fileData = await fs.readFile(configFileName, 'utf8');
      config = JSON.parse(fileData) as DumpConfig
      if (this.flags.outDir) {
        config.outDir = this.flags.outDir;
      }
    } else if (this.flags.objects) {
      config = {
        outDir: this.flags.outDir,
        targets: (this.flags.objects as string).split(/\s*,\s*/).map((object) => ({
          object,
        })),
      };
    }

    const conn = this.org.getConnection();
    const am = new AutoMigrator(conn);

    const csvs = await am.dumpAsCSVData(config.targets);
    const filepaths = await Promise.all(
      config.targets.map(async ({ object }, i) => {
        const csv = csvs[i];
        const filename = `${object}.csv`;
        const filepath = `${config.outDir}`
        await fs.writeFile(filename, 'utf8', csv);
        return filepath;
      })
    );
    return { filepaths };
  }
}
