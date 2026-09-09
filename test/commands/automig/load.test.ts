import { expect, test } from '@salesforce/command/lib/test';
import * as automig from 'salesforce-migration-automatic';
import fs = require('fs-extra');

describe('automig:load', () => {
  const files: { [filepath: string]: string } = {};
  let loadOptions: automig.UploadOptions | undefined;
  //
  const ts = test
    .withOrg({ username: 'test@example.org' }, true)
    .stub(automig.AutoMigrator.prototype, 'loadCSVData', <any>(
      async function loadCSVDataStub(
        _inputs: any,
        _mappings: any,
        options: automig.UploadOptions,
      ) {
        loadOptions = options;
        return {
          totalCount: 1,
          successes: [{ object: 'Account', origId: 'a001', newId: 'a101' }],
          failures: [],
          blocked: [],
          idMap: new Map([['a001', 'a101']]),
        };
      }
    ))
    .stub(fs, 'readdir', <any>function readdirStub(dirpath: string) {
      if (dirpath === 'path/to/csv') {
        return ['Account.csv', 'Contact.csv'];
      } else {
        return [];
      }
    })
    .stub(fs, 'readFile', <any>function readFileStub(filepath: string) {
      switch (filepath) {
        case 'path/to/csv/Account.csv':
          return `Id,ParentId\na001,\na002,a001`;
        case 'path/to/csv/Contact.csv':
          return `Id,AccountId\nc001,a001\nc002,a001\nc003,a002\nc004,a002\nc005,a002`;
        case 'path/to/idmap.json':
          return `{"a001": "a101"}`;
        case 'path/to/csv/automig-meta.json':
          return JSON.stringify({
            baseDate: '2026-01-01',
            dumpedAt: '2026-01-01T03:00:00.000Z',
          });
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
    .stub(fs, 'outputFile', <any>(
      function outputFileStub(filepath: string, data: string) {
        files[filepath] = data;
      }
    ))
    .stub(fs, 'existsSync', <any>function existsSync(filepath: string) {
      switch (filepath) {
        case 'path/to/csv/Account.csv':
        case 'path/to/csv/Contact.csv':
        case 'path/to/idmap.json':
        case 'path/to/automig-load-config.json':
        case 'path/to/csv/automig-meta.json':
          return true;
        default:
          return false;
      }
    })
    .stdout();

  /**
   *
   */
  ts.command([
    'automig:load',
    '--targetusername',
    'test@example.org',
    '--inputdir',
    'path/to/csv',
  ]).it('runs automig:load --inputdir path/to/csv', (ctx) => {
    expect(ctx.stdout).includes('Successes: 1');
  });

  /**
   *
   */
  ts.command([
    'automig:load',
    '--targetusername',
    'test@example.org',
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
    '--targetusername',
    'test@example.org',
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
    '--targetusername',
    'test@example.org',
    '--config',
    'path/to/automig-load-config.json',
  ]).it(
    'runs automig:load --config path/to/automig-load-config.json',
    (ctx) => {
      expect(ctx.stdout).includes('Successes: 1');
      expect(loadOptions?.dateShift).to.be.undefined;
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--targetusername',
    'test@example.org',
    '--inputdir',
    'path/to/csv',
    '--shiftdates',
  ]).it(
    'runs automig:load --inputdir path/to/csv --shiftdates using the dump date in automig-meta.json',
    (ctx) => {
      expect(ctx.stdout).includes('Date shift: ');
      expect(ctx.stdout).includes('from 2026-01-01 to ');
      expect(loadOptions?.dateShift).to.eql({
        baseDate: '2026-01-01',
        targetDate: undefined,
      });
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--targetusername',
    'test@example.org',
    '--inputdir',
    'path/to/csv',
    '--shiftdates',
    '--basedate',
    '2026-02-01',
    '--targetdate',
    '2026-03-03',
  ]).it(
    'runs automig:load --inputdir path/to/csv --shiftdates --basedate 2026-02-01 --targetdate 2026-03-03',
    (ctx) => {
      expect(ctx.stdout).includes(
        'Date shift: +30 days (from 2026-02-01 to 2026-03-03)',
      );
      expect(loadOptions?.dateShift).to.eql({
        baseDate: '2026-02-01',
        targetDate: '2026-03-03',
      });
    },
  );

  /**
   *
   */
  ts.command([
    'automig:load',
    '--targetusername',
    'test@example.org',
    '--inputdir',
    'path/to/nometa',
    '--shiftdates',
    '--json',
  ]).it(
    'fails automig:load --shiftdates when no base date is available',
    (ctx) => {
      const output = JSON.parse(ctx.stdout);
      expect(output.status).to.equal(1);
      expect(output.message).includes('No base date found');
    },
  );
});
