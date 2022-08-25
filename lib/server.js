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
  readAllData,
  readAllPage,
  readAllPost,
  readAllLayout,
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
    console.log(chalk.blue("Server is up and running at http://localhost:" + config.port));
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

  site.pages.forEach((page) => {
    if (page.fullpath == "/index.html") {
      app.get("/", (req, res) => {
        res.send(processPagesAndPosts(site, page));
      });
    }
    if (page.fullpath != "/index.html" && page.name == "index.html") {
      app.get(path.dirname(page.fullpath), (req, res) => {
        if (req._parsedUrl.pathname == path.dirname(page.fullpath)) {
          res.redirect(req._parsedUrl.pathname + '/');
        } else {
          res.send(processPagesAndPosts(site, page));
        }
      });
    }
    app.get(page.actualpath, (req, res) => {
      res.send(processPagesAndPosts(site, page));
    });
  });

  site.posts.forEach((post) => {
    if (post.fullpath == "/index.html") {
      app.get("/", (req, res) => {
        res.send(processPagesAndPosts(site, post, config.port));
      });
    }
    if (post.fullpath != "/index.html" && post.name == "index.html") {
      app.get(path.dirname(posts.fullpath), (req, res) => {
        if (req._parsedUrl.pathname == path.dirname(post.fullpath)) {
          res.redirect(req._parsedUrl.pathname + '/');
        } else {
          res.send(processPagesAndPosts(site, post, config.port));
        }
      });
    }
    app.get(post.actualpath, (req, res) => {
      res.send(processPagesAndPosts(site, post, config.port));
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
  chokidar.watch(allPaths.src,{
    ignored: '**/db.json',
    ignoreInitial : true,
  }).on('ready', () => {
    console.log('Initial scan complete. Ready for changes')
  }).on('all', async (event, name)=>{
    // //let the server wait for some seconds
    // if (shouldWatch){
    //   shouldWatch = false
    //   setTimeout(() => {
    //     shouldWatch = true
    //   }, 10);
    // }else{
    //   return;
    // }

    // ignore other operations
    if (event == 'unlink' || path.extname(name).length == 0) {
      return
    }

    // ignore the db.json update
    if (path.basename(name) == 'db.json' || name.includes(path.resolve(allPaths.create))) return;

    // console.log about change detected
    console.log(chalk.yellow(`INFO ${event.toUpperCase()} Detected in ${name}`))
    const start = Date.now()

    // validate config
    await validateConfig();

    // list of promises
    let promises = [
      readAllData(),
      readAllPage(),
      readAllPost(),
    ]
    let isAnServerUpdate = true;

    // include the process based on file update
    if (name.includes(path.resolve(allPaths.template))) {
      promises.push(readTemplate())
    } else if (name.includes(path.resolve(allPaths.layout))) {
      promises.push(readAllLayout())
    } else if (name.includes(path.resolve(allPaths.post))) {
      promises.push(readAllPost())
    } else if (name.includes(path.resolve(allPaths.page))) {
      promises.push(readAllPage())
    } else if (name.includes(path.resolve(allPaths.data))) {
      promises.push(readAllData())
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
    console.log(chalk.green(`INFO Server Refreshed in : ${(stop - start)} ms\n`));

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
    readAllData(),
    readImages(),
    readAllPage(),
    readAllPost(),
    readAllLayout(),
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