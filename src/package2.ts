import AdmZip = require('adm-zip');
import { Connection } from '@salesforce/core';
import {
  buildPackageZip,
  PackageBuildParams,
} from 'salesforce-migration-app-pack';
import { delay } from './util';

const POLL_INTERVAL = 10000;
const INSTALL_URL_BASE =
  'https://login.salesforce.com/packaging/installPackage.apexp?p0=';

export type Package2 = {
  Id: string;
  Name: string;
};

export type Package2VersionCreateRequest = {
  Id: string;
  Status: string;
  Package2VersionId: string | null;
};

export type Package2Version = {
  Id: string;
  SubscriberPackageVersionId: string;
  MajorVersion: number;
  MinorVersion: number;
  PatchVersion: number;
  BuildNumber: number;
  IsReleased: boolean;
};

function randid() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Prefix of API names of the components in the package.
 * Derived from the package id so that every version of the package updates the same components.
 * Kept short because Visualforce page names are limited to 40 characters.
 */
export function getPackagePrefix(packageId: string) {
  return `DMPack_${packageId.substring(3, 15)}`;
}

export function getInstallUrl(subscriberPackageVersionId: string) {
  return INSTALL_URL_BASE + subscriberPackageVersionId;
}

export function formatVersionNumber(version: Package2Version) {
  return `${version.MajorVersion}.${version.MinorVersion}.${version.PatchVersion}.${version.BuildNumber}`;
}

export async function getPackage2(conn: Connection, packageId: string) {
  const { records } = await conn.tooling.query<Package2>(
    `SELECT Id, Name FROM Package2 WHERE Id = '${packageId}'`,
  );
  if (records.length === 0) {
    throw new Error(`Package not found in Dev Hub: ${packageId}`);
  }
  return records[0];
}

export async function createPackage2(conn: Connection, name: string) {
  const ret = await conn.tooling.sobject('Package2').create({
    Name: name,
    NamespacePrefix: '',
    ContainerOptions: 'Unlocked',
    IsOrgDependent: false,
  });
  if (!ret.success) {
    throw new Error(`Failed to create package: ${ret.errors.join(', ')}`);
  }
  return { Id: ret.id, Name: name } as Package2;
}

/**
 * Build the VersionInfo blob of Package2VersionCreateRequest,
 * a zip which bundles the package descriptor and the metadata package zip.
 */
export function buildVersionInfo(params: {
  packageId: string;
  packageZip: Buffer;
  versionNumber: string;
  versionName: string;
  versionDescription?: string;
}) {
  const {
    packageId,
    packageZip,
    versionNumber,
    versionName,
    versionDescription,
  } = params;
  const descriptor = {
    id: packageId,
    path: 'package',
    versionNumber,
    versionName,
    ...(versionDescription ? { versionDescription } : {}),
    ancestorId: '',
  };
  const zip = new AdmZip();
  zip.addFile(
    'package2-descriptor.json',
    Buffer.from(JSON.stringify(descriptor)),
  );
  zip.addFile('package.zip', packageZip);
  return zip.toBuffer().toString('base64');
}

export async function createPackage2VersionCreateRequest(
  conn: Connection,
  params: {
    packageId: string;
    versionInfo: string;
    installationKey?: string;
  },
) {
  const { packageId, versionInfo, installationKey } = params;
  const ret = await conn.tooling
    .sobject('Package2VersionCreateRequest')
    .create({
      Package2Id: packageId,
      VersionInfo: versionInfo,
      InstallKey: installationKey,
      // required to promote the version, even when the package has no Apex
      CalculateCodeCoverage: true,
      SkipValidation: false,
    });
  if (!ret.success) {
    throw new Error(
      `Failed to request package version creation: ${ret.errors.join(', ')}`,
    );
  }
  return ret.id;
}

export async function waitPackage2VersionCreateRequest(
  conn: Connection,
  requestId: string,
  timeout: number,
  onProgress?: (status: string) => void,
) {
  const timeoutAt = Date.now() + timeout;
  for (;;) {
    const { records } = await conn.tooling.query<Package2VersionCreateRequest>(
      `SELECT Id, Status, Package2VersionId FROM Package2VersionCreateRequest WHERE Id = '${requestId}'`,
    );
    const request = records[0];
    if (!request) {
      throw new Error(`Package version create request not found: ${requestId}`);
    }
    if (request.Status === 'Success') {
      return request;
    }
    if (request.Status === 'Error') {
      const errors = await conn.tooling.query<{ Message: string }>(
        `SELECT Message FROM Package2VersionCreateRequestError WHERE ParentRequest.Id = '${requestId}'`,
      );
      throw new Error(
        [
          'Package version creation failed:',
          ...errors.records.map((e) => ` - ${e.Message}`),
        ].join('\n'),
      );
    }
    if (Date.now() >= timeoutAt) {
      throw new Error(
        `Package version creation timed out (request id: ${requestId}, status: ${request.Status})`,
      );
    }
    if (onProgress) {
      onProgress(request.Status);
    }
    await delay(POLL_INTERVAL);
  }
}

export async function getPackage2Version(
  conn: Connection,
  packageVersionId: string,
) {
  const { records } = await conn.tooling.query<Package2Version>(
    `SELECT Id, SubscriberPackageVersionId, MajorVersion, MinorVersion, PatchVersion, BuildNumber, IsReleased FROM Package2Version WHERE Id = '${packageVersionId}'`,
  );
  if (records.length === 0) {
    throw new Error(`Package version not found: ${packageVersionId}`);
  }
  return records[0];
}

export async function promotePackage2Version(
  conn: Connection,
  packageVersionId: string,
) {
  const ret = await conn.tooling.sobject('Package2Version').update({
    Id: packageVersionId,
    IsReleased: true,
  });
  if (!ret.success) {
    throw new Error(
      `Failed to promote package version: ${ret.errors.join(', ')}`,
    );
  }
}

export type CreatePackageVersionParams = {
  packageId?: string;
  packageName?: string;
  versionNumber: string;
  versionName?: string;
  versionDescription?: string;
  installationKey?: string;
  timeout: number;
  build: Omit<PackageBuildParams, 'apiVersion' | 'packagePrefix'>;
};

export type CreatePackageVersionResult = {
  packageId: string;
  packageName: string;
  packageVersionId: string;
  subscriberPackageVersionId: string;
  versionNumber: string;
  installUrl: string;
};

/**
 * Create a released version of the unlocked package which bundles the migration app.
 * The package is created in the Dev Hub when no existing package id is given.
 */
export async function createPackageVersion(
  conn: Connection,
  params: CreatePackageVersionParams,
  onProgress: (message: string) => void = () => {},
): Promise<CreatePackageVersionResult> {
  const {
    packageId,
    packageName,
    versionNumber,
    versionName,
    versionDescription,
    installationKey,
    timeout,
    build,
  } = params;
  const pkg = packageId
    ? await getPackage2(conn, packageId)
    : await createPackage2(
        conn,
        packageName || `Data Migration Pack (${randid()})`,
      );
  onProgress('Building package metadata');
  const { zip } = await buildPackageZip({
    ...build,
    apiVersion: conn.getApiVersion(),
    packagePrefix: getPackagePrefix(pkg.Id),
  });
  const versionInfo = buildVersionInfo({
    packageId: pkg.Id,
    packageZip: zip,
    versionNumber,
    versionName: versionName || versionNumber.replace(/\.NEXT$/i, ''),
    versionDescription,
  });
  const requestId = await createPackage2VersionCreateRequest(conn, {
    packageId: pkg.Id,
    versionInfo,
    installationKey,
  });
  const request = await waitPackage2VersionCreateRequest(
    conn,
    requestId,
    timeout,
    (status) => onProgress(`Package version create request: ${status}`),
  );
  const packageVersionId = request.Package2VersionId as string;
  onProgress('Promoting package version');
  await promotePackage2Version(conn, packageVersionId);
  const version = await getPackage2Version(conn, packageVersionId);
  return {
    packageId: pkg.Id,
    packageName: pkg.Name,
    packageVersionId,
    subscriberPackageVersionId: version.SubscriberPackageVersionId,
    versionNumber: formatVersionNumber(version),
    installUrl: getInstallUrl(version.SubscriberPackageVersionId),
  };
}
