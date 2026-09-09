import { expect } from 'chai';
import AdmZip = require('adm-zip');
import * as sinon from 'sinon';
import {
  buildVersionInfo,
  createPackageVersion,
  getPackagePrefix,
  waitPackage2VersionCreateRequest,
} from '../src/package2';
import * as util from '../src/util';

/**
 * Fake of Dev Hub tooling API which records requests
 */
function createFakeConnection(options: { fail?: boolean } = {}) {
  const created: Array<{ type: string; record: any }> = [];
  const updated: Array<{ type: string; record: any }> = [];
  const queried: string[] = [];
  let polled = 0;
  const query = sinon.stub().callsFake(async (soql: string) => {
    queried.push(soql);
    if (/FROM Package2 WHERE/.test(soql)) {
      return {
        records: [{ Id: '0Ho000000000001AAA', Name: 'Existing Pack' }],
      };
    }
    if (/FROM Package2VersionCreateRequestError/.test(soql)) {
      return { records: [{ Message: 'something went wrong' }] };
    }
    if (/FROM Package2VersionCreateRequest/.test(soql)) {
      polled++;
      const Status =
        polled < 2 ? 'InProgress' : options.fail ? 'Error' : 'Success';
      return {
        records: [
          {
            Id: '08c000000000001AAA',
            Status,
            Package2VersionId:
              Status === 'Success' ? '05i000000000001AAA' : null,
          },
        ],
      };
    }
    if (/FROM Package2Version WHERE/.test(soql)) {
      return {
        records: [
          {
            Id: '05i000000000001AAA',
            SubscriberPackageVersionId: '04t000000000001AAA',
            MajorVersion: 1,
            MinorVersion: 0,
            PatchVersion: 0,
            BuildNumber: 3,
            IsReleased: true,
          },
        ],
      };
    }
    throw new Error(`unexpected query: ${soql}`);
  });
  const sobject = (type: string) => ({
    create: async (record: any) => {
      created.push({ type, record });
      return {
        success: true,
        id: type === 'Package2' ? '0Ho000000000002AAA' : '08c000000000001AAA',
      };
    },
    update: async (record: any) => {
      updated.push({ type, record });
      return { success: true, id: record.Id };
    },
  });
  const conn = {
    getApiVersion: () => '52.0',
    tooling: { query, sobject },
  };
  return { conn: conn as any, created, updated, queried };
}

const inputs = [
  {
    object: 'Account',
    csvData: 'Id,Name\n001000000000001AAA,Account 01',
  },
];

describe('package2', () => {
  let delay: sinon.SinonStub;

  beforeEach(() => {
    // skip polling interval
    delay = sinon.stub(util, 'delay').resolves();
  });

  afterEach(() => {
    delay.restore();
  });

  it('derives stable package prefix from package id', () => {
    expect(getPackagePrefix('0Ho5g000000CaRXCA0')).to.equal(
      'DataMigrationPack_5g000000CaRX',
    );
  });

  it('builds version info with descriptor and metadata package', () => {
    const packageZip = new AdmZip();
    packageZip.addFile('package.xml', Buffer.from('<Package/>'));
    const versionInfo = buildVersionInfo({
      packageId: '0Ho000000000001AAA',
      packageZip: packageZip.toBuffer(),
      versionNumber: '1.0.0.NEXT',
      versionName: '1.0.0',
    });
    const zip = new AdmZip(Buffer.from(versionInfo, 'base64'));
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries.sort()).to.eql(['package.zip', 'package2-descriptor.json']);
    const descriptor = JSON.parse(zip.readAsText('package2-descriptor.json'));
    expect(descriptor).to.eql({
      id: '0Ho000000000001AAA',
      path: 'package',
      versionNumber: '1.0.0.NEXT',
      versionName: '1.0.0',
      ancestorId: '',
    });
    const inner = new AdmZip(zip.readFile('package.zip') as Buffer);
    expect(inner.getEntries().map((e) => e.entryName)).to.eql(['package.xml']);
  });

  it('creates package, version, and promotes it', async () => {
    const { conn, created, updated } = createFakeConnection();
    const progress: string[] = [];
    const res = await createPackageVersion(
      conn,
      {
        packageName: 'New Pack',
        versionNumber: '1.0.0.NEXT',
        timeout: 60000,
        build: { inputs },
      },
      (message) => progress.push(message),
    );
    expect(created.map((c) => c.type)).to.eql([
      'Package2',
      'Package2VersionCreateRequest',
    ]);
    expect(created[0].record).to.eql({
      Name: 'New Pack',
      NamespacePrefix: '',
      ContainerOptions: 'Unlocked',
      IsOrgDependent: false,
    });
    const request = created[1].record;
    expect(request.Package2Id).to.equal('0Ho000000000002AAA');
    expect(request.InstallKey).to.be.undefined;
    const versionInfo = new AdmZip(Buffer.from(request.VersionInfo, 'base64'));
    const descriptor = JSON.parse(
      versionInfo.readAsText('package2-descriptor.json'),
    );
    expect(descriptor.id).to.equal('0Ho000000000002AAA');
    expect(descriptor.versionName).to.equal('1.0.0');
    const metadata = new AdmZip(versionInfo.readFile('package.zip') as Buffer);
    const files = metadata.getEntries().map((e) => e.entryName);
    expect(files).to.include('package.xml');
    expect(files).to.include(
      'pages/DataMigrationPack_000000000002_CommanderPage.page',
    );
    expect(updated).to.eql([
      {
        type: 'Package2Version',
        record: { Id: '05i000000000001AAA', IsReleased: true },
      },
    ]);
    expect(res).to.eql({
      packageId: '0Ho000000000002AAA',
      packageName: 'New Pack',
      packageVersionId: '05i000000000001AAA',
      subscriberPackageVersionId: '04t000000000001AAA',
      versionNumber: '1.0.0.3',
      installUrl:
        'https://login.salesforce.com/packaging/installPackage.apexp?p0=04t000000000001AAA',
    });
    expect(progress).to.include('Package version create request: InProgress');
  });

  it('uses existing package and installation key', async () => {
    const { conn, created } = createFakeConnection();
    const res = await createPackageVersion(conn, {
      packageId: '0Ho000000000001AAA',
      versionNumber: '1.1.0.NEXT',
      versionName: 'Summer',
      versionDescription: 'summer release',
      installationKey: 'secret',
      timeout: 60000,
      build: { inputs },
    });
    expect(created.map((c) => c.type)).to.eql(['Package2VersionCreateRequest']);
    const request = created[0].record;
    expect(request.Package2Id).to.equal('0Ho000000000001AAA');
    expect(request.InstallKey).to.equal('secret');
    const descriptor = JSON.parse(
      new AdmZip(Buffer.from(request.VersionInfo, 'base64')).readAsText(
        'package2-descriptor.json',
      ),
    );
    expect(descriptor.versionName).to.equal('Summer');
    expect(descriptor.versionDescription).to.equal('summer release');
    expect(res.packageName).to.equal('Existing Pack');
  });

  it('reports errors of the failed request', async () => {
    const { conn } = createFakeConnection({ fail: true });
    let error: Error | undefined;
    try {
      await waitPackage2VersionCreateRequest(conn, '08c000000000001AAA', 60000);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include('something went wrong');
  });
});
