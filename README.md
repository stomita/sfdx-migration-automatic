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
<!-- usage -->
```sh-session
$ npm install -g sfdx-migration-automatic
$ sfdx-migration-automatic COMMAND
running command...
$ sfdx-migration-automatic (-v|--version|version)
sfdx-migration-automatic/1.4.2 darwin-x64 node-v8.14.0
$ sfdx-migration-automatic --help [COMMAND]
USAGE
  $ sfdx-migration-automatic COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx automig:dump [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx-automigdump---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx-automigload---json---loglevel-tracedebuginfowarnerrorfatal)

## `sfdx automig:dump [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Dump records in Salesforce org to CSV files for migration usage

```
USAGE
  $ sfdx automig:dump [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -d, --outputdir=outputdir                       output directory for dumped CSV files
  -f, --config=config                             dump configuration file

  -o, --objects=objects                           object names to dump, optionally paired with target scope (e.g.
                                                  Account,Contact,User:related)

  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --excludebom                                    do not prepend byte order mark (\ufeff) in output files

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx automig:dump --targetusername username@example.com --objects Opportunity,Case,Account:related,Task:related 
  --outputdir ./dump
  $ sfdx automig:dump --targetusername username@example.com --config automig-dump-config.json
```

_See code: [src/commands/automig/dump.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v1.4.2/src/commands/automig/dump.ts)_

## `sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Load records from CSV files to Salesforce org, resolving relationships between records

```
USAGE
  $ sfdx automig:load [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -d, --inputdir=inputdir                         (required) directory which includes input data files in CSV

  -m, --mappingobjects=mappingobjects             list of object and key field name pair to map to existing records
                                                  (e.g. User:Email,RecordType:DeveloperName

  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org

  --apiversion=apiversion                         override the api version used for api requests made by this command

  --deletebeforeload                              delete all records in target objects before loading

  --json                                          format output as json

  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

  --verbose                                       emit additional command output to stdout

EXAMPLES
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data
  $ sfdx automig:load --targetusername username@example.com --inputdir ./data --mappingobjects 
  User:Email,RecordType:DeveloperName
```

_See code: [src/commands/automig/load.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v1.4.2/src/commands/automig/load.ts)_
<!-- commandsstop -->
