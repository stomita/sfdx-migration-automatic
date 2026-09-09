import { expect, test } from '@salesforce/command/lib/test';
import fs = require('fs-extra');
import * as package2 from '../../../src/package2';

describe('automig:package', () => {
  let params: package2.CreatePackageVersionParams | undefined;
  //
  const ts = test
    .withOrg({ username: 'devhub@example.org', isDevHub: true }, true)
    .stub(package2, 'createPackageVersion', <any>(
      async function createPackageVersion(
        _conn: any,
        params_: package2.CreatePackageVersionParams,
      ) {
        params = params_;
        return {
          packageId: '0Ho000000000001AAA',
          packageName: 'Data Migration Pack (test)',
          packageVersionId: '05i000000000001AAA',
          subscriberPackageVersionId: '04t000000000001AAA',
          versionNumber: '1.0.0.1',
          installUrl:
            'https://login.salesforce.com/packaging/installPackage.apexp?p0=04t000000000001AAA',
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

  beforeEach(() => {
    params = undefined;
  });

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--inputdir',
    'path/to/csv',
  ]).it('runs automig:package --inputdir path/to/csv', (ctx) => {
    expect(ctx.stdout).includes('Package Version ID: 05i000000000001AAA');
    expect(ctx.stdout).includes(
      'Install URL: https://login.salesforce.com/packaging/installPackage.apexp?p0=04t000000000001AAA',
    );
    expect(params?.packageId).to.be.undefined;
    expect(params?.versionNumber).to.equal('1.0.0.NEXT');
    expect(params?.timeout).to.equal(10 * 60 * 1000);
    expect(params?.build.inputs.map((input) => input.object)).to.eql([
      'Account',
      'Contact',
    ]);
  });

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--inputdir',
    'path/to/csv',
    '--mappingobjects',
    'User:Email,RecordType:DeveloperName',
  ]).it(
    'runs automig:package --inputdir path/to/csv --mappingobjects User:Email,RecordType:DeveloperName',
    (ctx) => {
      expect(ctx.stdout).includes('Package Version ID: 05i000000000001AAA');
      expect(params?.build.mappings).to.eql([
        { object: 'User', keyField: 'Email' },
        { object: 'RecordType', keyField: 'DeveloperName' },
      ]);
    },
  );

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--config',
    'path/to/automig-load-config.json',
  ]).it(
    'runs automig:package --config path/to/automig-load-config.json',
    (ctx) => {
      expect(ctx.stdout).includes('Package Version ID: 05i000000000001AAA');
      expect(params?.build.inputs.map((input) => input.object)).to.eql([
        'Account',
      ]);
    },
  );

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--inputdir',
    'path/to/csv',
    '--packageid',
    '0Ho000000000001AAA',
    '--versionnumber',
    '1.2.0.NEXT',
    '--versionname',
    'Summer',
    '--installationkey',
    'secret',
    '--wait',
    '30',
  ]).it('runs automig:package with package version options', (ctx) => {
    expect(ctx.stdout).includes('Package ID: 0Ho000000000001AAA');
    expect(params?.packageId).to.equal('0Ho000000000001AAA');
    expect(params?.versionNumber).to.equal('1.2.0.NEXT');
    expect(params?.versionName).to.equal('Summer');
    expect(params?.installationKey).to.equal('secret');
    expect(params?.timeout).to.equal(30 * 60 * 1000);
  });

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--inputdir',
    'path/to/csv',
    '--shiftdates',
  ]).it('runs automig:package --inputdir path/to/csv --shiftdates', (ctx) => {
    expect(ctx.stdout).includes('Package Version ID: 05i000000000001AAA');
    expect(params?.build.options?.dateShift).to.eql({
      baseDate: '2026-01-01',
      targetDate: undefined,
    });
  });

  /**
   *
   */
  ts.command([
    'automig:package',
    '--targetdevhubusername',
    'devhub@example.org',
    '--inputdir',
    'path/to/csv',
    '--json',
  ]).it('runs automig:package --inputdir path/to/csv --json', (ctx) => {
    const output = JSON.parse(ctx.stdout);
    expect(output.status).to.equal(0);
    expect(output.result.subscriberPackageVersionId).to.equal(
      '04t000000000001AAA',
    );
  });
});
