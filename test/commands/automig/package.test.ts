import { expect, test } from '@salesforce/command/lib/test';
import * as apppack from 'salesforce-migration-app-pack';
import * as fs from 'fs-extra';

describe('automig:package', () => {
  const files: { [filepath: string]: string } = {};
  //
  const ts = test
    .withOrg({ username: 'test@example.org' }, true)
    .stub(apppack, 'createPackage', async function createPackage(
      _inputs: any,
      _options: any,
    ) {
      return {
        id: 'p1234567',
        status: 'Succeeded',
        success: true,
        done: true,
        numberComponentErrors: 0,
        numberComponentsDeployed: 2,
        numberComponentsTotal: 2,
        numberTestErrors: 0,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        packageInfo: { Id: 'p000001' },
      };
    })
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
  ts.command(['automig:package', '--inputdir', 'path/to/csv']).it(
    'runs automig:package --inputdir path/to/csv',
    (ctx) => {
      expect(ctx.stdout).includes('Succeeded');
    },
  );

  /**
   *
   */
  ts.command([
    'automig:package',
    '--inputdir',
    'path/to/csv',
    '--mappingobjects',
    'User:Email,RecordType:DeveloperName',
  ]).it(
    'runs automig:package --inputdir path/to/csv --mappingobjects User:Email,RecordType:DeveloperName',
    (ctx) => {
      expect(ctx.stdout).includes('Succeeded');
    },
  );

  /**
   *
   */
  ts.command([
    'automig:package',
    '--config',
    'path/to/automig-load-config.json',
  ]).it(
    'runs automig:package --config path/to/automig-load-config.json',
    (ctx) => {
      expect(ctx.stdout).includes('Succeeded');
    },
  );
});
