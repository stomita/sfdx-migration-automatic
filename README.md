sfdx-migration-automatic
========================

SFDX plugin to dump/load record data to/from CSV files to easily migrate data between orgs


[![Version](https://img.shields.io/npm/v/sfdx-migration-automatic.svg)](https://npmjs.org/package/sfdx-migration-automatic)
[![CircleCI](https://circleci.com/gh/stomita/sfdx-migration-automatic/tree/master.svg?style=shield)](https://circleci.com/gh/stomita/sfdx-migration-automatic/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/stomita/sfdx-migration-automatic?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfdx-migration-automatic/branch/master)
[![Codecov](https://codecov.io/gh/stomita/sfdx-migration-automatic/branch/master/graph/badge.svg)](https://codecov.io/gh/stomita/sfdx-migration-automatic)
[![Greenkeeper](https://badges.greenkeeper.io/stomita/sfdx-migration-automatic.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/stomita/sfdx-migration-automatic/badge.svg)](https://snyk.io/test/github/stomita/sfdx-migration-automatic)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-migration-automatic.svg)](https://npmjs.org/package/sfdx-migration-automatic)
[![License](https://img.shields.io/npm/l/sfdx-migration-automatic.svg)](https://github.com/stomita/sfdx-migration-automatic/blob/master/package.json)

<!-- toc -->

<!-- tocstop -->
<!-- install -->
## Install
<!-- usage -->
```sh-session
$ sfdx plugins:install sfdx-migration-automatic
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`sfdx automig:dump [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-automigdump---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-automigload---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx automig:package [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-automigpackage---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx automig:dump [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Dump records in Salesforce org to CSV files for migration usage

```
USAGE
  $ sfdx automig:dump [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --outputdir=outputdir                                                         output directory for dumped CSV
                                                                                    files

  -f, --config=config                                                               dump configuration file

  -i, --idmap=idmap                                                                 id map file

  -n, --defaultnamespace=defaultnamespace                                           developer namespace prefix for
                                                                                    managed packages

  -o, --objects=objects                                                             object names to dump, optionally
                                                                                    paired with target scope (e.g.
                                                                                    Account,Contact,User:related)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --excludebom                                                                      do not prepend byte order mark
                                                                                    (\ufeff) in output files

  --ignorefields=ignorefields                                                       list of object.field path to exclude
                                                                                    from dumping (e.g.
                                                                                    Account.OwnerId,OpportunityLineItem.
                                                                                    TotalPrice)

  --ignorereadonly                                                                  exclude non-createable fields from
                                                                                    the dump target

  --ignoresystemdate                                                                exclude system-defined date fields
                                                                                    from the dump target (e.g.
                                                                                    CreatedDate, LastModifiedDate)

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --verbose                                                                         emit additional command output to
                                                                                    stdout

EXAMPLES
  $ sfdx automig:dump --targetusername username@example.com --objects Opportunity,Case,Account:related,Task:related 
  --outputdir ./dump
  $ sfdx automig:dump --targetusername username@example.com --config automig-dump-config.json
```

_See code: [src/commands/automig/dump.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v4.0.0/src/commands/automig/dump.ts)_

## `sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Load records from CSV files to Salesforce org, resolving relationships between records

```
USAGE
  $ sfdx automig:load [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --inputdir=inputdir                                                           directory which includes input data
                                                                                    files in CSV

  -f, --config=config                                                               load configuration file

  -i, --idmap=idmap                                                                 id map file

  -m, --mappingobjects=mappingobjects                                               list of object and key field name
                                                                                    pair to map to existing records
                                                                                    (e.g.
                                                                                    User:Email,RecordType:DeveloperName

  -n, --defaultnamespace=defaultnamespace                                           developer namespace prefix for
                                                                                    managed packages

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --deletebeforeload                                                                delete all records in target objects
                                                                                    before loading

  --ignorefields=ignorefields                                                       list of object.field path to exclude
                                                                                    from loading (e.g.
                                                                                    Account.OwnerId,OpportunityLineItem.
                                                                                    TotalPrice)

  --ignoreobjects=ignoreobjects                                                     list of object names to exclude from
                                                                                    loading

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --targetobjects=targetobjects                                                     list of object names to include in
                                                                                    loading

  --verbose                                                                         emit additional command output to
                                                                                    stdout

EXAMPLES
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data --mappingobjects 
  User:Email,RecordType:DeveloperName
```

_See code: [src/commands/automig/load.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v4.0.0/src/commands/automig/load.ts)_

## `sfdx automig:package [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Bundle CSV record data as a Salesforce Package, including web UI for one-click data import

```
USAGE
  $ sfdx automig:package [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --inputdir=inputdir                                                           directory which includes input data
                                                                                    files in CSV

  -f, --config=config                                                               load configuration file

  -m, --mappingobjects=mappingobjects                                               list of object and key field name
                                                                                    pair to map to existing records
                                                                                    (e.g.
                                                                                    User:Email,RecordType:DeveloperName

  -n, --defaultnamespace=defaultnamespace                                           developer namespace prefix for
                                                                                    managed packages

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --ignorefields=ignorefields                                                       list of object.field path to exclude
                                                                                    from loading (e.g.
                                                                                    Account.OwnerId,OpportunityLineItem.
                                                                                    TotalPrice)

  --ignoreobjects=ignoreobjects                                                     list of object names to exclude from
                                                                                    loading

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --targetobjects=targetobjects                                                     list of object names to include in
                                                                                    loading

  --verbose                                                                         emit additional command output to
                                                                                    stdout

EXAMPLES
  $ sfdx automig:package --targetusername username@example.com --inputdir ./data
  $ sfdx automig:package --targetusername username@example.com --inputdir ./data --mappingobjects 
  User:Email,RecordType:DeveloperName
```

_See code: [src/commands/automig/package.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v4.0.0/src/commands/automig/package.ts)_
<!-- commandsstop -->

## Configuration

The `sfdx-migration-automatic` is available as a command without any prior configuration, but you can also provide a file if you want fine-grained control over the dump/load.

### Dump Configuration File

```js
{
    "outputDir": "./dump",
    "targets": [
        {
          /**
           * Select object to extract records.
           * All records in the objects will be extracted.
           * All the fields in the object definition are included in the results.
           * Same as `--objects=Account` in CLI.
           */
            "target": "query",
            "object": "Account"
        },
        {
          /**
           * Select records by specifying query conditions.
           * Specified fields are only to be included in the results.
           */
            "target": "query",
            "object": "Opportunity",
            "fields": ["Id", "Name", "AccountId", "StageName", "Amount"],
            "condition": "IsWon=true",
            "orderby": "ClosedDate DESC",
            "limit": 50000
        },
        {
          /**
           * Select records that are referenced by other records.
           * Same as `--objects=Contact:related` in CLI
           */
            "target": "related",
            "object": "Contact"
        },
        {
          /**
           * The `fields` can be specified in comma-separated string
           */
            "target": "related",
            "object": "User",
            "fields": "Id, Email"
        },
        {
          /**
           * The `ignoreFields` can exclude fields from the object definition.
           */
            "target": "related",
            "object": "OpportunityLineItem",
            "ignoreFields": "TotalPrice"
        },
        {
            "target": "related",
            "object": "PricebookEntry",
            "fields": ["Id", "Name"]
        }
    ],
    /**
     * Replaces the dumped record IDs to reverse-mapped IDs.
     * Assuming the id map file is generated by the former `automig:load` command on the same org.
     */
    "idMapFile": "./path/to/idmap.json"
}
```

### Load Configuration File

```js
{
    /**
     * Directory path with CSV files to load. Required.
     */
    "inputDir": "./dump",

    /**
     * List of the uploading target object. Optional - if not specified, all CSV files in the input dir will be the target
     */
    "targets": [
        {
            "object": "Account"
        },
        {
            "object": "Opportunity",
            "fields": ["Id", "Name", "AccountId", "StageName", "Amount"],
        },
        {
            "object": "OpportunityLineItem",
            "ignoreFields": "TotalPrice"
        },
    ],

    /**
     * objects used as existing record mapping
     */
    "mappings": [
        // Maps input records to records in destination org which match spefiled key field value.
        // Thus the specified key field should be included in the CSV.
        {
            "object": "User",
            "keyField": "Email"
        },
        // If you specify multiple key fields, records matching all fields' value will be selected.
        // The specified key fields should be included in the CSV.
        {
            "object": "PricebookEntry",
            "keyFields": "Name,CurrencyIsoCode"
        },
        // By `defaultMapping`, records without matching key field value will be replaced to the specified default record id.
        // Use static record id which exists in the destination org.
        {
            "object": "User",
            "defaultMapping": "00528000000iBrVAAU"
        },
        // Use query to determine the mapping record in the destiniation org
        {
            "object": "User",
            "defaultMapping": {
              "condition": "IsActive = true AND Name = 'Standard User'",
              "orderby": "CreatedDate DESC"
            }
        }
    ]

    /**
     * File path to dump the result of the loaded record id map (orig => new).
     * If there is a previously created id map file, input records in id map entry will be excluded from the upload.
     */
    "idMapFile": "./path/to/idmap.json"
}
```
