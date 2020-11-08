import { expect, test } from '@salesforce/command/lib/test';
import * as automig from 'salesforce-migration-automatic';
import * as fs from 'fs-extra';

import { EventEmitter } from 'events';

describe('automig:load', () => {
  //
  const ts = test
    .withOrg({ username: 'test@example.org' }, true)
    .stub(
      automig,
      'AutoMigrator',
      class AutoMigratorStub extends EventEmitter {
        async loadCSVData(_inputs: any) {
          return {
            totalCount: 0,
            successes: [{ object: 'Account', origId: 'a001', newId: 'a101' }],
            failures: [],
            blocked: [],
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
      if (filepath === 'path/to/csv/Account.csv') {
        return `Id,ParentId\na001,\na002,a001`;
      } else if (filepath === 'path/to/csv/Contact.csv') {
        return `Id,AccountId\nc001,a001\nc002,a001\nc003,a002\nc004,a002\nc005,a002`;
      } else {
        throw new Error('file not found: ' + filepath);
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
});
