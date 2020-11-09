import { core, flags, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { existsSync, readFile, outputFile } from 'fs-extra';
import { Connection } from 'jsforce';
import * as path from 'path';
import {
  AutoMigrator,
  DumpProgress,
  DumpQuery,
} from 'salesforce-migration-automatic';
import { convertObjectLiteralToMap, toStringList } from '../../util';

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
    ignorefields: flags.array({
      description: messages.getMessage('ignoreFieldsFlagDescription'),
    }),
    ignoresystemdate: flags.boolean({
      description: messages.getMessage('ignoreSystemDateFlagDescription'),
    }),
    ignorereadonly: flags.boolean({
      description: messages.getMessage('ignoreReadOnlyFlagDescription'),
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

  public async run(): Promise<AnyJson> {
    // const name = this.flags.name || 'world';

    interface DumpConfig {
      outputDir: string;
      targets: DumpQuery[];
      idMapFile?: string;
      ignoreSystemDate?: boolean;
      ignoreReadOnly?: boolean;
    }

    // Read configuration file
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
      if (this.flags.idmap) {
        config.idMapFile = this.flags.idmap;
      } else if (config.idMapFile && !path.isAbsolute(config.idMapFile)) {
        config.idMapFile = path.join(configDir, config.idMapFile);
      }
    } else if (this.flags.objects) {
      config = {
        outputDir: this.flags.outputdir || '.',
        targets: this.flags.objects,
        idMapFile: this.flags.idmap,
      };
    } else {
      throw new Error(
        'No --config or --objects options are supplied to command arg',
      );
    }
    const ignoreSystemDate: boolean | undefined =
      config.ignoreSystemDate || this.flags.ignoresystemdate;
    const ignoreReadOnly: boolean | undefined =
      config.ignoreReadOnly || this.flags.ignorereadonly;
    const objectIgnoreFields = new Map<string, string[]>();
    if (this.flags.ignorefields) {
      for (const fieldPath of this.flags.ignorefields as string[]) {
        const [object, field] = fieldPath.split('.');
        const ignoreFields = [...(objectIgnoreFields.get(object) ?? []), field];
        objectIgnoreFields.set(object, ignoreFields);
      }
    }

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

    // Read id map from file
    let idMap: Map<string, string> | undefined = undefined;
    if (config.idMapFile && existsSync(config.idMapFile)) {
      const idMapJson = await readFile(config.idMapFile, 'utf8');
      idMap = convertObjectLiteralToMap(
        JSON.parse(idMapJson) as { [k: string]: string },
      );
    }

    // Start dumping
    let fetchedCount = 0;
    let fetchedCountPerObject: { [name: string]: number } = {};
    am.on('dumpProgress', (status: DumpProgress) => {
      fetchedCount = status.fetchedCount;
      fetchedCountPerObject = status.fetchedCountPerObject;
      const perObjectCount = Object.keys(fetchedCountPerObject)
        .map((object) => `${object}: ${fetchedCountPerObject[object]}`)
        .join(', ');
      const message = `fetched count: ${fetchedCount}, ${perObjectCount}`;
      this.ux.setSpinnerStatus(message);
    });
    this.ux.startSpinner('dumping records');
    const targets = config.targets.map((target) => {
      const ignoreFields = objectIgnoreFields.get(target.object);
      if (ignoreFields) {
        return {
          ...target,
          ignoreFields: [
            ...toStringList(target.ignoreFields ?? []),
            ...ignoreFields,
          ],
        };
      }
      return target;
    });
    const csvs = await am.dumpAsCSVData(targets, {
      defaultNamespace,
      idMap,
      ignoreSystemDate,
      ignoreReadOnly,
    });
    this.ux.stopSpinner();
    this.ux.log(`fetched count: ${fetchedCount}`);
    const results = await Promise.all(
      config.targets.map(async ({ object }, i) => {
        const csv = csvs[i];
        const count = fetchedCountPerObject[object] || 0;
        const filename = `${object}.csv`;
        const filepath = path.join(config.outputDir, filename);
        const bom = this.flags.excludebom ? '' : '\ufeff';
        await outputFile(filepath, bom + csv, 'utf8');
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
