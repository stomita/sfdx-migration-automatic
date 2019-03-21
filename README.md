sfdx-migration-automatic
========================



[![Version](https://img.shields.io/npm/v/sfdx-migration-automatic.svg)](https://npmjs.org/package/sfdx-migration-automatic)
[![CircleCI](https://circleci.com/gh/stomita/sfdx-migration-automatic/tree/master.svg?style=shield)](https://circleci.com/gh/stomita/sfdx-migration-automatic/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/stomita/sfdx-migration-automatic?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfdx-migration-automatic/branch/master)
[![Codecov](https://codecov.io/gh/stomita/sfdx-migration-automatic/branch/master/graph/badge.svg)](https://codecov.io/gh/stomita/sfdx-migration-automatic)
[![Greenkeeper](https://badges.greenkeeper.io/stomita/sfdx-migration-automatic.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/stomita/sfdx-migration-automatic/badge.svg)](https://snyk.io/test/github/stomita/sfdx-migration-automatic)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-migration-automatic.svg)](https://npmjs.org/package/sfdx-migration-automatic)
[![License](https://img.shields.io/npm/l/sfdx-migration-automatic.svg)](https://github.com/stomita/sfdx-migration-automatic/blob/master/package.json)

<!-- toc -->
* [Debugging your plugin](#debugging-your-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g sfdx-migration-automatic
$ sfdx-migration-automatic COMMAND
running command...
$ sfdx-migration-automatic (-v|--version|version)
sfdx-migration-automatic/1.2.1 darwin-x64 node-v8.14.0
$ sfdx-migration-automatic --help [COMMAND]
USAGE
  $ sfdx-migration-automatic COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx-migration-automatic <%= command.id %> [-f <string>] [-o <array>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx-migration-automatic--commandid---f-string--o-array--d-string--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)
* [`sfdx-migration-automatic <%= command.id %> -d <string> [-m <array>] [--deletebeforeload] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`](#sfdx-migration-automatic--commandid---d-string--m-array---deletebeforeload--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfatal)

## `sfdx-migration-automatic <%= command.id %> [-f <string>] [-o <array>] [-d <string>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Dump data in Salesforce org to CSV files, for migration usage

```
USAGE
  $ sfdx-migration-automatic automig:dump [-f <string>] [-o <array>] [-d <string>] [-u <string>] [--apiversion <string>] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -d, --outputdir=outputdir                       output directory of dumped CSV files
  -f, --config=config                             dump configuration file
  -o, --objects=objects                           objects to dump
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx automig:dump --targetusername username@example.com --objects Opportunity,Case,Account:related,Task:related 
  --outputdir ./dump
  $ sfdx automig:dump --targetusername username@example.com --config automig-dump-config.json
```

_See code: [src/commands/automig/dump.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v1.2.1/src/commands/automig/dump.ts)_

## `sfdx-migration-automatic <%= command.id %> -d <string> [-m <array>] [--deletebeforeload] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]`

Load data from CSV files in directory to Salesforce org to CSV files

```
USAGE
  $ sfdx-migration-automatic automig:load -d <string> [-m <array>] [--deletebeforeload] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal]

OPTIONS
  -d, --inputdir=inputdir                         (required) directory of loading CSV files
  -m, --mappingobjects=mappingobjects             list of object and key field pair to map to existing records
  -u, --targetusername=targetusername             username or alias for the target org; overrides default target org
  --apiversion=apiversion                         override the api version used for api requests made by this command
  --deletebeforeload                              Delete all records in target object before loading
  --json                                          format output as json
  --loglevel=(trace|debug|info|warn|error|fatal)  [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx automig:load --targetusername username@example.com --dir ./data
  $ sfdx automig:load --targetusername username@example.com --dir ./data --mappingobjects 
  User:Email,RecordType:DeveloperName
```

_See code: [src/commands/automig/load.ts](https://github.com/stomita/sfdx-migration-automatic/blob/v1.2.1/src/commands/automig/load.ts)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
# Debugging your plugin
We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands.

To debug the `hello:org` command: 
1. Start the inspector
  
If you linked your plugin to the sfdx cli, call your command with the `dev-suspend` switch: 
```sh-session
$ sfdx hello:org -u myOrg@example.com --dev-suspend
```
  
Alternatively, to call your command using the `bin/run` script, set the `NODE_OPTIONS` environment variable to `--inspect-brk` when starting the debugger:
```sh-session
$ NODE_OPTIONS=--inspect-brk bin/run hello:org -u myOrg@example.com
```

2. Set some breakpoints in your command code
3. Click on the Debug icon in the Activity Bar on the side of VS Code to open up the Debug view.
4. In the upper left hand corner of VS Code, verify that the "Attach to Remote" launch configuration has been chosen.
5. Hit the green play button to the left of the "Attach to Remote" launch configuration window. The debugger should now be suspended on the first line of the program. 
6. Hit the green play button at the top middle of VS Code (this play button will be to the right of the play button that you clicked in step #5).
<br><img src=".images/vscodeScreenshot.png" width="480" height="278"><br>
Congrats, you are debugging!
