import { expect, test } from '@salesforce/command/lib/test';
import * as automig from 'salesforce-migration-automatic';
import * as fs from 'fs-extra';

import { EventEmitter } from 'events';


describe('automig:dump', () => {
  const files: { [filepath: string]: string } = {};
  //
  const ts = test
    .withOrg({ username: 'test@example.org' }, true)
    .stub(automig, 'AutoMigrator', class AutoMigratorStub extends EventEmitter {
      async dumpAsCSVData(queries) {
        return queries.map(() => 'A,B\na1,b1\na2,b2');
      }
    })
    .stub(fs, 'readFile', function readFileStub(filepath) {
      if (filepath === 'path/to/automig-dump-config.json') {
        return JSON.stringify({
          outDir: 'dist',
          targets: [{
            object: 'Account',
          }, {
            object: 'Contact',
          }],
        });
      } else {
        throw new Error('file not found: ' + filepath);
      }
    })
    .stub(fs, 'writeFile', function writeFileStub(filepath, data) {
      files[filepath] = data;
    })
    .stdout();
  
  /**
   * 
   */
  ts.command(['automig:dump', '--objects', 'Account,Contact', '--outdir', 'path/to/dir'])
    .it('runs automig:dump --objects Account,Contact --outdir path/to/dir', ctx => {
      expect(ctx.stdout).includes('path/to/dir/Account.csv');
      expect(ctx.stdout).includes('path/to/dir/Contact.csv');
      for (const filepath of ['path/to/dir/Account.csv', 'path/to/dir/Account.csv']) {
        expect(files[filepath]).is.not.empty;
      }
    })
  
  /*
   * 
   */
  ts.command(['automig:dump', '--config', 'path/to/automig-dump-config.json'])
    .it('runs automig:dump --config path/to/automig-dump-config.json', ctx => {
      expect(ctx.stdout).includes('path/to/dist/Account.csv');
      expect(ctx.stdout).includes('path/to/dist/Contact.csv');
      for (const filepath of ['path/to/dist/Account.csv', 'path/to/dist/Account.csv']) {
        expect(files[filepath]).is.not.empty;
      }
    });
});
