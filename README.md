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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx automig:dump --targetusername username@example.com --objects Opportunity,Case,Account:related,Task:related 
  --outputdir ./dump
  $ sfdx automig:dump --targetusername username@example.com --config automig-dump-config.json
```

_See code: [src/commands/automig/dump.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v2.1.0/src/commands/automig/dump.ts)_

## `sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Load records from CSV files to Salesforce org, resolving relationships between records

```
USAGE
  $ sfdx automig:load [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --inputdir=inputdir                                                           (required) directory which includes
                                                                                    input data files in CSV

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --verbose                                                                         emit additional command output to
                                                                                    stdout

EXAMPLES
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data --mappingobjects 
  User:Email,RecordType:DeveloperName
```

_See code: [src/commands/automig/load.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v2.1.0/src/commands/automig/load.ts)_
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
    ]
}
```