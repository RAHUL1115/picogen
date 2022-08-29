const path = require('path')
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');
const chalk = require('chalk')
const chokidar = require('chokidar');

let {
  config,
  allPaths,
  allFunction,
  db,
  validateConfig,
} = require('./global/config')

let app;
let server;
let client = [];


let {
  readImages,
  readData,
  readPage,
  readPost,
  readLayout,
  readTemplate,
  processPagesAndPosts,
} = require('./global/files')


let createServer = (doNotLog) => {
  app = new tinyApp();
  app.use((req, res, next) => {
    let result = req.url.match(/(.ejs)/g)
    if (result) {
      return res.status(403).end('403 Forbidden')
    }
    next()
  }, serveStatic(allPaths.static));
  server = app.listen(config.port);
  if (!doNotLog) {
    console.log(chalk.blue("INFO - Server is up and running at http://localhost:" + config.port));
  }
  if (config.shouldRefresh) {
    app.get('/_reload', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      });
      client.push(res);
      req.on('close', () => {
        let clientIndex = client.indexOf(res);
        if (clientIndex != -1) {
          client.splice(clientIndex, 1);
        }
      });
    });
  }
}

let updateServer = (preLoadedSite) => {
  let site = preLoadedSite || db.JSON();

  app.middleware = app.middleware.filter((route) => {
    return !(route.type == "route") || (route.path == "/_reload");
  });

  
  [...site.pages, ...site.posts].forEach((page) => {
    if (page.name == "index.html") {
      app.get(path.dirname(page.fullpath), (req, res) => {
        // add a slash at the end of the page if is is not home page
        if (page.fullpath != "/index.html" && req._parsedUrl.pathname == path.dirname(page.fullpath)) {
          res.redirect(req._parsedUrl.pathname + '/');
        } else {
          res.send(processPagesAndPosts(site, page));
        }
      });
    }else{
      app.get(page.fullpath.split('.').slice(0, -1).join('.'), (req, res) => {
        res.send(processPagesAndPosts(site, page));
      });
    }
    app.get(page.fullpath, (req, res) => {
      res.send(processPagesAndPosts(site, page));
    });
  });

  app.get('/siteSearch.json', (req, res) => {
    res.send(allFunction.processSiteSearch([...site.pages, ...site.posts]));
  });
}

let liveReload = () => {
  let clientInterval = setInterval(() => {
    if (client.length > 0) {
      client.forEach((res) => {
        res.end()
      });
      clearInterval(clientInterval);
      setTimeout(() => {
        config.isRefreshedRecently = false;
      }, config.waitForNewRefresh);
    }
  }, config.refreshInterval);
}

let watcher = () => {
  chokidar.watch([allPaths.src,allPaths.config],{
    ignored: '**/db.json',
    ignoreInitial : true,
  }).on('ready', () => {
    console.log(chalk.green('INFO - Initial scan complete. Ready for changes'))
  }).on('all', async (event, name)=>{

    // ignore other operations
    if (!(event == 'add' || event == "change" || event == "unlink")) {
      return
    }

    // ignore the db.json update
    if (path.basename(name) == 'db.json' || name.includes(path.resolve(allPaths.create))) return;

    // console.log about change detected
    console.log(chalk.yellow(`INFO - ${event.toUpperCase()} Detected in ${name}`))
    const start = Date.now()

    // validate config
    await validateConfig();

    // check if it is an server update
    let isAnServerUpdate = true;

    // list of promises
    let promises = [
    ]

    // include the process based on file update
    if (name.includes(path.resolve(allPaths.template))) {
      promises.push(readTemplate())
    } else if (name.includes(path.resolve(allPaths.component))) {
      promises.push(readTemplate())
    } else if (name.includes(path.resolve(allPaths.layout))) {
      promises.push(readLayout())
    } else if (name.includes(path.resolve(allPaths.post))) {
      promises.push(readPost())
    } else if (name.includes(path.resolve(allPaths.page))) {
      promises.push(readPage())
    } else if (name.includes(path.resolve(allPaths.data))) {
      promises.push(readData())
    } else if (['.jpg', '.png', '.svg', '.jpeg'].includes(path.extname(name))) {
      promises.push(readImages())
    } else {
      isAnServerUpdate = false;
    }

    if (isAnServerUpdate) {
      // wait for the process to be done
      await Promise.all(promises).catch((error) => {
        console.log(error);
      });

      // update the server
      updateServer();
    }

    // log about the time
    const stop = Date.now()
    console.log(chalk.green(`INFO - Server Refreshed in : ${(stop - start)} ms\n`));

    // live reload
    if (config.shouldRefresh && !config.isRefreshedRecently) {
      config.isRefreshedRecently = true;
      liveReload();
    }
  })
}

module.exports = serverHandler = async () => {

  await validateConfig();
  Promise.all([
    readData(),
    readImages(),
    readPage(),
    readPost(),
    readLayout(),
    readTemplate(),
    db.JSON(),
  ]).then(async (results) => {
    createServer();
    updateServer();
    watcher();
    results = undefined;
  }).catch((error) => {
    console.log(error)
  });
}