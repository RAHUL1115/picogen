const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');
const ejs = require("ejs");
const watch = require("node-watch");
const csvjson = require('csvjson');
const {
  exit
} = require('process');

let app;
let server;
let client = [];
let config, validateConfig, readAllData, readImages, readAllPage, readAllPost, readAllLayout, readTemplate, processPagesAndPosts, allPaths, allFunction, db


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
    console.log("Server is up and running at http://localhost:" + config.port);
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
    res.send(allFunction.processSiteSreach([...site.pages, ...site.posts]));
  });
}

let liveReload = () => {
  let clientinterval = setInterval(() => {
    if (client.length > 0) {
      client.forEach((res) => {
        res.end()
      });
      clearInterval(clientinterval);
      setTimeout(() => {
        config.isRefreshedRecentely = false;
      }, config.waitForNewRefresh);
    }
  }, config.refreshIntervel);
}

let watcher = () => {
  watch([allPaths.src], {
    recursive: true,
  }, async (evt, name) => {
    if (path.basename(name) == 'db.json') return;
    await validateConfig();
    await Promise.all([
      readAllData(),
      readAllPage(),
      readAllPost(),
      readAllLayout(),
      readTemplate(),
    ]).catch((error) => {
      console.log('errore' + error);
    });
    updateServer();
    if (config.shouldRefresh && !config.isRefreshedRecentely) {
      config.isRefreshedRecentely = true;
      liveReload();
    }
  });
}

module.exports = serverHandeler = async (_config, _validateConfig, _readAllData, _readImages, _readAllPage, _readAllPost, _readAllLayout, _readTemplate, _processPagesAndPosts, _allPaths, _allFunction, _db) => {
  config = _config
  validateConfig = _validateConfig
  readAllData = _readAllData
  readImages = _readImages
  readAllPage = _readAllPage
  readAllPost = _readAllPost
  readAllLayout = _readAllLayout
  readTemplate = _readTemplate
  processPagesAndPosts = _processPagesAndPosts
  allPaths = _allPaths
  allFunction = _allFunction
  db = _db

  await validateConfig();
  Promise.all([
    readImages(),
    readAllData(),
    readAllPage(),
    readAllPost(),
    readAllLayout(),
    readTemplate(),
    db.JSON(),
  ]).then(async (results) => {
    createServer(false, allPaths, allPaths, allFunction, db);
    updateServer();
    watcher();
    results = undefined;
  }).catch((error) => {
    console.log(error)
  });
}