import { core, flags, SfdxCommand } from '@salesforce/command';
import { fs } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { readFile, writeFile } from 'fs-extra';
import { Connection } from 'jsforce';
import * as path from 'path';
import { AutoMigrator, DumpQuery } from 'salesforce-migration-automatic';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfdx-migration-automatic', 'dump');

export default class Dump extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static get usage() {
    return SfdxCommand.usage.replace('<%= command.id %>', 'automig:dump');
  }

  public static examples = [
    '$ sfdx automig:dump --targetusername username@example.com --objects Opportunity,Case,Account:related,Task:related --outputdir ./dump',
    '$ sfdx automig:dump --targetusername username@example.com --config automig-dump-config.json',
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    config: flags.filepath({
      char: 'f',
      description: messages.getMessage('configFlagDescription'),
    }),
    objects: flags.array({
      char: 'o',
      description: messages.getMessage('objectsFlagDescription'),
      map: (value: string) => {
        const [object, target = 'query'] = value.split(':');
        return { object, target };
      },
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('outputDirFlagDescription'),
    }),
    defaultnamespace: flags.string({
      char: 'n',
      description: messages.getMessage('defaultNamespaceFlagDescription'),
    }),
    excludebom: flags.boolean({
      description: messages.getMessage('excludeBomFlagDescription'),
    }),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    // const name = this.flags.name || 'world';

    interface DumpConfig {
      outputDir: string;
      targets: DumpQuery[];
    }

    let config: DumpConfig;
    if (this.flags.config) {
      const configFileName: string = this.flags.config;
      const configDir = path.dirname(configFileName);
      const fileData = await readFile(configFileName, 'utf8');
      config = JSON.parse(fileData) as DumpConfig;
      if (this.flags.outputdir) {
        config.outputDir = this.flags.outputdir;
      } else if (!path.isAbsolute(config.outputDir)) {
        config.outputDir = path.join(configDir, config.outputDir);
      }
    } else if (this.flags.objects) {
      config = {
        outputDir: this.flags.outputdir || '.',
        targets: this.flags.objects,
      };
    } else {
      throw new Error(
        'No --config or --objects options are supplied to command arg',
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

    let fetchedCount = 0;
    let fetchedCountPerObject = {};
    am.on('dumpProgress', (status) => {
      fetchedCount = status.fetchedCount;
      fetchedCountPerObject = status.fetchedCountPerObject;
      const perObjectCount = Object.keys(fetchedCountPerObject)
        .map((object) => `${object}: ${fetchedCountPerObject[object]}`)
        .join(', ');
      const message = `fetched count: ${fetchedCount}, ${perObjectCount}`;
      this.ux.setSpinnerStatus(message);
    });
    this.ux.startSpinner('dumping records');
    const csvs = await am.dumpAsCSVData(config.targets, { defaultNamespace });
    this.ux.stopSpinner();
    this.ux.log(`fetched count: ${fetchedCount}`);
    try {
      await fs.stat(config.outputDir);
    } catch (e) {
      await fs.mkdirp(config.outputDir);
    }
    const results = await Promise.all(
      config.targets.map(async ({ object }, i) => {
        const csv = csvs[i];
        const count = fetchedCountPerObject[object] || 0;
        const filename = `${object}.csv`;
        const filepath = path.join(config.outputDir, filename);
        const bom = this.flags.excludebom ? '' : '\ufeff';
        await writeFile(filepath, bom + csv, 'utf8');
        return { filepath, count };
      }),
    );
    this.ux.log();
    this.ux.table(results, {
      columns: [
        {
          key: 'filepath',
          label: 'Output File Path',
        },
        {
          key: 'count',
          label: 'Count',
        },
      ],
    });
    return { fetchedCount, results };
  }
}
