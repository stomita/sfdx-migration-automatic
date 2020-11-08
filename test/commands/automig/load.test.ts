import { expect, test } from '@salesforce/command/lib/test';
import * as automig from 'salesforce-migration-automatic';
import * as fs from 'fs-extra';

import { EventEmitter } from 'events';

describe('automig:load', () => {
  const files: { [filepath: string]: string } = {};
  //
  const ts = test
    .withOrg({ username: 'test@example.org' }, true)
    .stub(
      automig,
      'AutoMigrator',
      class AutoMigratorStub extends EventEmitter {
        async loadCSVData(_inputs: any, _options: any) {
          return {
            totalCount: 1,
            successes: [{ object: 'Account', origId: 'a001', newId: 'a101' }],
            failures: [],
            blocked: [],
            idMap: new Map([['a001', 'a101']]),
          };
        }
      },
    )
    .stub(fs, 'readdir', function readdirStub(dirpath: string) {
      if (dirpath === 'path/to/csv') {
        return ['Account.csv', 'Contact.csv'];
      } else {
        return [];
      }
    })
    .stub(fs, 'readFile', function readFileStub(filepath: string) {
      switch (filepath) {
        case 'path/to/csv/Account.csv':
          return `Id,ParentId\na001,\na002,a001`;
        case 'path/to/csv/Contact.csv':
          return `Id,AccountId\nc001,a001\nc002,a001\nc003,a002\nc004,a002\nc005,a002`;
        case 'path/to/idmap.json':
          return `{"a001": "a101"}`;
        case 'path/to/automig-load-config.json':
          return JSON.stringify({
            inputDir: './csv',
            targets: [
              {
                object: 'Account',
              },
              {
                object: 'User',
              },
            ],
            mapppings: [
              {
                object: 'User',
                defaultMapping: 'u001',
              },
            ],
          });
        default:
          throw new Error('file not found: ' + filepath);
      }
    })
    .stub(fs, 'outputFile', function outputFileStub(
      filepath: string,
      data: string,
    ) {
      files[filepath] = data;
    })
    .stub(fs, 'existsSync', function existsSync(filepath: string) {
      switch (filepath) {
        case 'path/to/csv/Account.csv':
        case 'path/to/csv/Contact.csv':
        case 'path/to/idmap.json':
        case 'path/to/automig-load-config.json':
          return true;
        default:
          return false;
      }
    })
    .stdout();

  /**
   *
   */
  ts.command(['automig:load', '--inputdir', 'path/to/csv']).it(
    'runs automig:load --inputdir path/to/csv',
    (ctx) => {
      expect(ctx.stdout).includes('Successes: 1');
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--inputdir',
    'path/to/csv',
    '--mappingobjects',
    'User:Email,RecordType:DeveloperName',
  ]).it(
    'runs automig:load --inputdir path/to/csv --mappingobjects User:Email,RecordType:DeveloperName',
    (ctx) => {
      expect(ctx.stdout).includes('Successes: 1');
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--inputdir',
    'path/to/csv',
    '--idmap',
    'path/to/idmap.json',
  ]).it(
    'runs automig:load --inputdir path/to/csv --idmap path/to/idmap.json',
    (ctx) => {
      expect(ctx.stdout).includes('Successes: 1');
      expect(files['path/to/idmap.json']).is.not.empty;
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--config',
    'path/to/automig-load-config.json',
  ]).it(
    'runs automig:load --config path/to/automig-load-config.json',
    (ctx) => {
      expect(ctx.stdout).includes('Successes: 1');
    },
  );
});
