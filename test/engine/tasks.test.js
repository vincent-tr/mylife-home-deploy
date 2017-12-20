'use strict';

const { expect }          = require('chai');
const tasks               = require('../../lib/engine/tasks');
const vfs                 = require('../../lib/engine/vfs');
const {
  formatStructure,
  expectConfigContent,
  expectConfigSymlink,
  //printLines
} = require('./utils');

const source = '/Users/vincent/Downloads/rpi-devel-base.tar.gz';

let cachedRoot;

const logger = (category, severity, message) => {
  console.log(`${severity} : [${category}] ${message}`); // eslint-disable-line no-console
};

async function initContext(options = {}) {
  if(options.noload) {
    return { logger };
  }

  if(!options.nocache && cachedRoot) {
    return { logger, root: cachedRoot };
  }

  const context = { logger };
  await tasks.ImageImport.execute(context, {
    archiveName : source,
    rootPath    : 'mmcblk0p1'
  });
  !options.nocache && (cachedRoot = context.root);
  return context;
}

describe('Tasks', () => {

  describe('ImageImport', () => {
    it('Should execute properly', async () => {
      const context = await initContext();

      expect(formatStructure(context.root)).to.deep.equal(require('./content/archive-base'));
    });
  });

  describe('ImagePack', () => {
    it('Should execute properly', async () => {
      const context = await initContext({ nocache : true });
      await tasks.ConfigInit.execute(context, {});
      await tasks.ImagePack.execute(context, {});

      expect(context.image).to.be.an.instanceof(Buffer);
      expect(context.image.length).to.equal(74553888);
    });
  });

  describe('ImageRemove', () => {
    it('Should execute properly', async () => {
      const context = await initContext({ nocache : true });
      await tasks.ImageRemove.execute(context, { path: '/apks/armhf/APKINDEX.tar.gz' });

      const content = require('./content/archive-base').filter(c => c.name !== 'APKINDEX.tar.gz');
      expect(formatStructure(context.root)).to.deep.equal(content);
    });
  });

  describe('ImageCache', () => {
    it('Should execute properly', async () => {
      const context = await initContext({ nocache : true });
      await tasks.ConfigInit.execute(context, {});
      await tasks.ConfigPackage.execute(context, { name : 'nodejs' });
      await tasks.ImageCache.execute(context, {});

      const cache = vfs.path(context.root, [ 'cache' ]);
      const list  = cache.list().map(f => f.name);

      expect(list).to.deep.equal(require('./content/cache'));
    });
  });

  // ImageInstall

  describe('ImageReset', () => {
    it('Should execute properly', async () => {
      const context = await initContext({ nocache : true });
      await tasks.ConfigInit.execute(context, {});
      await tasks.ImagePack.execute(context, {});
      await tasks.VariablesSet.execute(context, { name: 'variable', value: 'value' });
      await tasks.ImageReset.execute(context, {});

      expect(context.variables).to.deep.equal({ variable : 'value' });
      expect(context.root).to.be.null;
      expect(context.config).to.be.null;
      expect(context.image).to.be.null;
    });
  });

  describe('ConfigInit', () => {
    it('Should execute properly', async () => {
      const context = await initContext();
      await tasks.ConfigInit.execute(context, {});

      expect(formatStructure(context.root)).to.deep.equal(require('./content/archive-base'));
      expect(formatStructure(context.config)).to.deep.equal(require('./content/archive-config'));
    });
  });

  describe('ConfigHostname', () => {
    it('Should execute properly', async () => {
      const hostname = 'test-host';
      const context  = await initContext();
      await tasks.ConfigInit.execute(context, {});

      await tasks.ConfigHostname.execute(context, {
        hostname
      });

      expectConfigContent(context, [ 'etc', 'hostname' ]);
      expectConfigContent(context, [ 'etc', 'network', 'interfaces' ]);
      expectConfigContent(context, [ 'etc', 'hosts' ]);
    });
  });

  // ConfigWifi

  describe('ConfigDaemon', () => {
    it('Should execute properly', async () => {
      const runlevel = 'default';
      const name = 'test-daemon';
      const context  = await initContext();
      await tasks.ConfigInit.execute(context, {});

      await tasks.ConfigDaemon.execute(context, {
        name, runlevel
      });

      expectConfigSymlink(context, [ 'etc', 'runlevels', runlevel, name ], `/etc/init.d/${name}`);
    });
  });

  describe('ConfigPackage', () => {
    it('Should execute properly', async () => {
      const name = 'test-package';
      const context  = await initContext();
      await tasks.ConfigInit.execute(context, {});

      await tasks.ConfigPackage.execute(context, {
        name
      });

      expectConfigContent(context, [ 'etc', 'apk', 'world' ]);
    });
  });

  // ConfigCoreComponents

  describe('VariablesSet', () => {
    it('Should execute properly', async () => {
      const context = await initContext({ noload: true });
      await tasks.VariablesSet.execute(context, { name: 'variable', value: 'value' });

      expect(context.variables).to.deep.equal({ variable : 'value' });
    });
  });

  describe('VariablesReset', () => {
    it('Should execute properly', async () => {
      const context = await initContext();
      await tasks.ConfigInit.execute(context, {});
      await tasks.ImagePack.execute(context, {});
      await tasks.VariablesSet.execute(context, { name: 'variable', value: 'value' });
      await tasks.VariablesReset.execute(context, {});


      expect(context.variables).to.be.null;
      expect(context.root).to.exist;
      expect(context.config).to.exist;
      expect(context.image).to.exist;
    });
  });
});
