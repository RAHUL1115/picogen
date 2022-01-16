//#region -----variables-----

const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');
const ejs = require("ejs");
const watch = require("node-watch");
const { exit } = require('process');

// #endregion


//#region -----variables and functions-----

// main variables
let app;
let server;
let client = [];
let config = {
  port: 4000,
  isRefreshedRecentely:false,
  shouldRefresh: true,
  shouldGenerateSitemap: false,
  shouldGenerateFeed : false,
  production : false,
  refreshIntervel : 500,
  waitForNewRefresh : 500,
};

// All paths
var allPaths = {
  config: path.join(path.resolve(), "src/_data/sitedata.json").replace(/\\/g, "/"),
  srcGlobal: path.join(__dirname, "../src").replace(/\\/g, "/"),
  src: path.join(path.resolve(), "src").replace(/\\/g, "/"),
  pagegen: path.join(path.resolve(), "src/_apagegen").replace(/\\/g, "/"),
  component: path.join(path.resolve(), "src/_component") + "\\",
  data: path.join(path.resolve(), "src/_data").replace(/\\/g, "/"),
  static: path.join(path.resolve(), "src/_static").replace(/\\/g, "/"),
  layout: path.join(path.resolve(), "src/_template/layout").replace(/\\/g, "/"),
  template: path.join(path.resolve(), "src/_template/main.ejs").replace(/\\/g, "/"),
  page: path.join(path.resolve(), "src/pages").replace(/\\/g, "/"),
  post: path.join(path.resolve(), "src/posts").replace(/\\/g, "/"),
  dbpath: path.join(path.resolve(), "src/db.json").replace(/\\/g, "/"),
  temp: path.join(path.resolve(), "src/.temp").replace(/\\/g, "/"),
  public: path.join(path.resolve(), "public").replace(/\\/g, "/"),
  siteSearch: path.join(path.resolve(), "public/siteSearch.json").replace(/\\/g, "/"),
  sitemap: path.join(path.resolve(), "public/sitemap.xml").replace(/\\/g, "/"),
  feed: path.join(path.resolve(), "public/feed.xml").replace(/\\/g, "/"),
}

// All functions
let allFunction = {
  getNchar: (str, n, max = 10) => {
    let absN = 0;

    for (var i = 0; i < max; i++) {
      if (str[n + i] == ' ') {
        absN = n + i;
        return str.substring(0, absN);
      }
      absN = n + i;
    }
    return str.substring(0, absN);
  },
  removeHtmlTags: (str) => {
    return str.replace(/(<([^>]+)>)/ig, '')
  },
  fixSlash: (str) => {
    if (str.includes(':\\')){
      str = str.replace(/:\\/g, '://');
    }
    return str.replace(/\\/g, '/')
  },
  deepfinder: (fullpath) => {
    let filepath = fullpath.split('/');
    filepath = filepath.map((splitpath, index) => {
      if (index == 0 || index == 1) {
        if (filepath.length == 2) {
          return (index == 0) ? "." : "/";
        } else {
          return "";
        }
      } else {
        return "../";
      }
    });
    return filepath.join('');
  },
  processPageData: (data, stat, fileData) => {
    let name = path.basename(fileData.fullname.replace(path.extname(fileData.name), ".html"))
    let fullpath = fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html")
    let actualpath = (config.removehtmlext && name != 'index.html') ? fullpath.replace('.html', '') : fullpath;
    return {
      "data": matter(data).data,
      "name": path.basename(fileData.fullname).replace(path.extname(fileData.name), ".html"),
      "path": path.dirname(fileData.fullname.replace(allPaths.page, "")),
      "fullpath": fullpath,
      "actualpath": actualpath,
      "srcfix": "./",
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/(include\()/g, '$1_path+'),
    }
  },
  processPostData: (data, stat, fileData) => {
    let postpath = (path.join(path.dirname(fileData.fullname), config.postPath, path.basename(fileData.fullname))).replace(/\\/g, '/');
    let name = path.basename(postpath.replace(path.extname(fileData.name), ".html"))
    let fullpath = postpath.replace(allPaths.post, "").replace(path.extname(fileData.name), ".html")
    let actualpath = (config.removehtmlext && name != 'index.html') ? fullpath.replace('.html', '') : fullpath;
    return {
      "data": matter(data).data,
      "name": name,
      "path": path.dirname(postpath.replace(allPaths.post, "")),
      "fullpath": fullpath,
      "actualpath": actualpath,
      "srcfix":"./",
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/(include\()/g, '$1_path+'),
    }
  },
  processTemplatandLaouteData: (data) => {
    return data.replace(/(include\()/g, '$1_path+');
  },
  processLayoutName: (name) => {
    return name.replace(allPaths.layout + "/", "").replace(".ejs", "");
  },
  processSiteSreach: (allPages) => {
    let siteSearch = []
    allPages.forEach((page) => {
      siteSearch.push({
        url: page.actualpath.replace('index.html', ''),
        title: page.data?.title,
        description: page.data?.description,
        data : page.data,
      });
    });
    return siteSearch;
  }
}

// database
let db = new JSONdb(allPaths.dbpath, {
  jsonSpaces: 0,
});

//#endregion -----variables-----


//#region -----pre process----

let processArguments = () => {
  const arg = require("arg");
  const args = arg({
    // Types
    '--sitemap': Boolean,
    '--feed': Boolean,
    '--noreload': Boolean,
    '--port': Number,
    '--production': Boolean,

    '-s': '--sitemap',
    '-f': '--feed',
    '-n': '--noreload',
    '-p': '--production',
    '-i': '--interval',
    '-P': '--port',
  }, {
    permissive: false,
    argv: process.argv.slice(2),
  })
  config.shouldGenerateSitemap = args['--sitemap'];
  config.shouldGenerateFeed = args['--feed'];
  config.shouldRefresh = !args['--noreload'];
  config.port = args['--port'] || 4000;
  config.refreshIntervel = args['--interval'] || config.refreshIntervel;
  config.production = args['--production'] || false;
  if (args._.length == 0) {
    args._[0] = 'server';
  }
  return args;
}

let validateConfig = () => new Promise((res, rej) => {
  let configData;
  try {
    configData = fs.readFileSync(allPaths.config, {encoding : null});
    configData = JSON.parse(configData)
  } catch (error) {
    console.error("config file is missing Or there is an error in conig data")
    process.exit(0)
  }

  config.postPath = configData.postPath || "";
  config.removehtmlext = configData.removehtmlext || false;
  config.removehtmlextgen = configData.removehtmlextgen || false;
  config.title = configData.title || "";
  config.description = configData.description || "";
  config.copyright = configData.copyright || "";
  config.image = configData.image || "";
  config.favicon = configData.favicon || "";
  res();
});

//#endregion


//#region ----init phase----

let init = async () => {
  if (fs.existsSync(allPaths.src)) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log("\nDirectory Already exist this process will remove src directory and all its content.")
    readline.question(
      "Do you still want to continue(y/n) : ",
      async (output) => {
        if (output == "y" || output == "Y") {
          fs.rmSync(allPaths.src, {
            recursive: true
          });
          fs.copy(allPaths.srcGlobal, allPaths.src).catch((error) => {
            console.log(error);
          })
          readline.close();
        } else {
          readline.close();
        }
      }
    );
  } else {
    await fs.mkdir(allPaths.src)
    fs.copySync(allPaths.srcGlobal, allPaths.src)
  }
}

//#endregion


//#region ----readFiles phase----

let readAllData = () => new Promise(async (res, rej) => {
  // get all data file path
  let allDataFiles = await rra.list(allPaths.data, {
    recursive: true,
  })
  if (allDataFiles.error) {
    allDataFiles = [];
  }

  // read all data files
  let dataFiles = {
    name: [],
    content: [],
    datajson: {},
  }
  allDataFiles.forEach((file) => {
    dataFiles.name.push(path.basename(file.name).replace(".json", ""));
    dataFiles.content.push(fs.readFile(file.fullname, "utf8"));
  })

  // process all data and save in database
  Promise.all(dataFiles.content).then((content) => {
    content.forEach((data, index) => {
      dataFiles.datajson[dataFiles.name[index]] = JSON.parse(data)
    });
    db.set("data", dataFiles.datajson)
    res();
  }).catch((err) => {
    console.log(err);
    rej()
  })
});

let readAllPage = () => new Promise(async (res, rej) => {
  // get all the files path
  let allPageFiles = await rra.list(allPaths.page);
  if (allPageFiles.error) {
    allPageFiles = [];
  }

  // read all files
  let pageFiles = {
    content: [],
    stat: [],
    parsedContent: [],
  }
  allPageFiles.forEach((file) => {
    pageFiles.content.push(fs.readFile(file.fullname, "utf8"));
    pageFiles.stat.push(fs.stat(file.fullname));
  })

  // process all files and save in database
  Promise.all(pageFiles.content).then((content) => {
    Promise.all(pageFiles.stat).then((stat) => {
      content.forEach((data, index) => {
        if (path.extname(allPageFiles[index].name) == ".ejs" || path.extname(allPageFiles[index].name) == ".html") {
          let pageJSON = allFunction.processPageData(data, stat[index], allPageFiles[index])
          pageJSON.srcfix = allFunction.deepfinder(pageJSON.fullpath);
          pageFiles.parsedContent.push(pageJSON)
        }
      });
      db.set("pages", pageFiles.parsedContent)
      res();
    }).catch((err) => {
      console.log(err);
      rej()
    })
  }).catch((err) => {
    console.log(err);
    rej()
  })
});

let readAllPost = () => new Promise(async (res, rej) => {
  // get all the files path
  let allPostFile = await rra.list(allPaths.post);
  if (allPostFile.error){
    allPostFile = [];
  }

  // read all files
  let postFiles = {
    content: [],
    stat: [],
    parsedContent: [],
  };
  allPostFile.forEach((file) => {
    postFiles.content.push(fs.readFile(file.fullname, "utf8"));
    postFiles.stat.push(fs.stat(file.fullname));
  });

  // process all files and save in database
  Promise.all(postFiles.content).then((content) => {
      Promise.all(postFiles.stat)
        .then((stat) => {
          content.forEach((data, index) => {
            if (path.extname(allPostFile[index].name) == ".ejs" || path.extname(allPostFile[index].name) == ".html") {
              let postJSON = allFunction.processPostData(data, stat[index], allPostFile[index])
              postJSON.srcfix = allFunction.deepfinder(postJSON.fullpath);
              postFiles.parsedContent.push(postJSON);
            }
          });
          db.set("posts", postFiles.parsedContent);
          res();
        })
        .catch((err) => {
          console.log(err);
          rej();
        });
    })
    .catch((err) => {
      console.log(err);
      rej();
    });
});

let readAllLayout = () => new Promise(async (res, rej) => {
  // get all layout file list
  let allLaoutFiles = await rra.list(allPaths.layout)
  if (allLaoutFiles.error){
    console.log('no default layout found add default.ejs in layout folder');
    allLaoutFiles = [];
    process.exit(0);
  }

  // read all layout files
  let layoutFiles = {
    content: [],
    layout: {},
  }
  allLaoutFiles.forEach((file) => {
    layoutFiles.content.push(fs.readFile(file.fullname, "utf8"));
  })

  // process and save the content in database
  Promise.all(layoutFiles.content).then((content) => {
    content.forEach((data, index) => {
      layoutFiles.layout[allFunction.processLayoutName(allLaoutFiles[index].fullname)] = allFunction.processTemplatandLaouteData(data);
    });
    db.set("layout", layoutFiles.layout);
    res()
  }).catch((err) => {
    console.log(err);
    rej()
  })
});

let readTemplate = () => new Promise(async (res, rej) => {
  // add include prefix and return modified content
  function processTemplateData(data) {
    return data.replace(/(include\()/g, '$1_path+');
  }

  // read and save the content in database
  fs.readFile(allPaths.template, "utf8").then((data) => {
    db.set("template", allFunction.processTemplatandLaouteData(data))
    res()
  }).catch((err) => {
    console.log("temoplate file is missing");
    process.exit(0)
  })
});

//#endregion


//#region -----server phase-----

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

let processPagesAndPosts = (site, page) => {
  let body = null;
  let modifiedPagesAndPosts = {
    pages:JSON.parse(JSON.stringify(site)).pages,
    posts: JSON.parse(JSON.stringify(site)).posts
  };
  modifiedPagesAndPosts.pages = modifiedPagesAndPosts.pages.map(page => {
    page.content = undefined;
    return page;
  });
  modifiedPagesAndPosts.posts = modifiedPagesAndPosts.posts.map(page => {
    page.content = undefined;
    return page;
  });

  // process pages
  try {
    let modifiedPage = JSON.parse(JSON.stringify(page));
    modifiedPage.content = undefined;
    page.content = (page.data?.renderInLayout) ? page.content.trim() : ejs.render(page.content.trim(), {
      getNchar: allFunction.getNchar,
      removeHtmlTags: allFunction.removeHtmlTags,
      page: modifiedPage,
      site: {
        data: site.data,
        pages: modifiedPagesAndPosts.pages,
        posts: modifiedPagesAndPosts.posts,
      },
      _production: config.production,
      _path: allPaths.component,
    });
  } catch (err) {
    console.log(err);
  }

  // process layout
  try {
    let pagelayout = page.data?.layout ? (site.layout[page.data.layout] || site.layout.default.trim()) : site.layout.default.trim();

    body = ejs.render(pagelayout, {
      getNchar: allFunction.getNchar,
      removeHtmlTags: allFunction.removeHtmlTags,
      page,
      site: {
        data: site.data,
        pages: site.pages,
        posts: modifiedPagesAndPosts.posts,
      },
      _production: config.production,
      _path: allPaths.component,
    });

    body = !(page.data?.renderInLayout) ? body : ejs.render(body, {
      getNchar: allFunction.getNchar,
      removeHtmlTags: allFunction.removeHtmlTags,
      page,
      site: {
        data: site.data,
        pages: site.pages,
        posts: site.posts,
      },
      _production: config.production,
      _path: allPaths.component,
    });
  } catch (err) {
    console.log(err)
    body = page.content;
  }

  // live reload code
  body = config.shouldRefresh ? body.concat(`
    <script>
      var evtSource = new EventSource("http://localhost:${config.port}/_reload");
      evtSource.onerror = function (e) {
        evtSource.close()
        location.reload();
      };
    </script>
  `).trim() : body;

  // render template
  return ejs.render(site.template.trim(), {
    getNchar: allFunction.getNchar,
    removeHtmlTags: allFunction.removeHtmlTags,
    body: body,
    page,
    site: {
      data: site.data,
      pages: site.pages,
      posts: site.posts,
    },
    getNchar: allFunction.getNchar,
    removeHtmlTags: allFunction.removeHtmlTags,
    _production: config.production,
    _path: allPaths.component
  });
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
      client.forEach((res)=>{res.end()});
      clearInterval(clientinterval);
      setTimeout(() => {
        config.isRefreshedRecentely = false;
      }, config.waitForNewRefresh);
    }
  }, config.refreshIntervel);
}

let watcher = () => {
  watch([allPaths.config, allPaths.data, allPaths.component, allPaths.layout, allPaths.page, allPaths.template, allPaths.static], {
    recursive: true
  }, async (evt, name) => {
    await validateConfig();
    let temp = await Promise.all([
      readAllData(),
      readAllPage(),
      readAllPost(),
      readAllLayout(),
      readTemplate(),
    ]);
    updateServer();
    if (config.shouldRefresh && !config.isRefreshedRecentely) {
      config.isRefreshedRecentely = true;
      liveReload();
    }
  });
}

let serverHandeler = async () => {
  await validateConfig();
  Promise.all([
    readAllData(),
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

//#endregion


//#region -----generation phase-----

let sitemapGen = (site) => new Promise((res, rej) => {
  let sitemap = '';
  sitemap += '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
  sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  allPages = [...site.pages, ...site.posts];
  allPages.forEach((page) => {
    if (!(page.data.noindex)) {
      let thispage = page.actualpath.replace('index.html', '');

      let priority = (thispage == '/') ?
        '1.0' :
        (thispage.split('/').length == 2 || thispage.split('/')[thispage.split('/').length - 1] == '') ?
        '0.80' :
        '0.64';

      sitemap += '\n\t\<url>';
      sitemap += `\n\t\t<loc>${site.data.sitedata.websiteurl+thispage}</loc>`;
      sitemap += `\n\t\t<lastmod>${new Date(page.modified).toISOString()}</lastmod>`;
      sitemap += `\n\t\t<priority>${priority}</priority>`;
      sitemap += '\n\t</url>';
    }
  });
  sitemap += '\n</urlset>';
  fs.writeFile(allPaths.sitemap, sitemap).then(() => {
    res();
  }).catch(() => {
    rej();
  })
});

let feedGen = (site) => new Promise((res, rej) => {
  const Feed = require("feed").Feed;

  let feedData = {
    title: config.title || "",
    description: config.description || "",
    link: config.websiteurl || "https://example.com",
    copyright: config.copyright || "",
  }
  if (config.image) {
    feedData.image = config.siteimage;
  }
  if (config.favicon) {
    feedData.favicon = config.favicon;
  }

  const feed = new Feed(feedData);

  site.posts.forEach((page) => {
    if (!(page.data.noindex)) {
      let thispage = page.actualpath;

      let FeedData = {
        title: page.data?.title || "",
        description : page.data?.description || "",
        id : config.websiteurl + thispage,
        link: config.websiteurl + thispage,
        date: new Date(page.created),
        content: page.content.trim(),
      }

      if(page.data?.image){
        if (page.data?.image.includes('http://') || page.data?.image.includes('https://')){
          FeedData.image = allFunction.fixSlash(page.data?.image);
        }else{          
          FeedData.image = allFunction.fixSlash(
            path.join(
              path.join(site.data.sitedata.websiteurl, page.path),
             page.srcfix + page.data?.image
            )
          );
        }
      }

      if (page.data?.author) {
        FeedData.author = {
          name: page.data.author,
        };
      }

      feed.addItem(FeedData);
    }
  });

  fs.writeFile(allPaths.feed, feed.rss2()).then(() => {
    res();
  }).catch(() => {
    rej();
  })
});

let siteSearch = (site) => new Promise(async (res, rej) => {
  let siteSearch = allFunction.processSiteSreach([...site.pages, ...site.posts]);
  await fs.mkdir(allPaths.public).catch(()=>{});
  await fs.writeFile(allPaths.siteSearch, JSON.stringify(siteSearch))
  res();
});

let generate = async (preLoadedSite) => {
  let site = preLoadedSite || db.JSON();
  let dirs = [];
  let files = [];
  console.time("All files generated in ");
  site.pages.forEach(async (page) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, page.fullpath))).catch(() => {}));
    files.push(
      fs.writeFile(path.join(allPaths.public, config.removehtmlextgen ? page.actualpath : page.fullpath),
        processPagesAndPosts(site, page)).catch(() => {})
    );
  });
  site.posts.forEach(async (post) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, post.fullpath))).catch(() => {}));
    files.push(
      fs.writeFile(path.join(allPaths.public, config.removehtmlextgen ? post.actualpath : post.fullpath),
        processPagesAndPosts(site, post)).catch(() => {})
    );
  });
  await Promise.all(dirs).catch((error) => {});
  await Promise.all([
    Promise.all(files).catch((error) => {}),
    fs.copy(allPaths.static, allPaths.public).catch((error) => {}),
  ]).catch((error) => {});

  await siteSearch(site);

  if (config.shouldGenerateSitemap) {
    await sitemapGen(site);
  } else if (config.shouldGenerateFeed) {
    await feedGen(site);
  } else {
    console.timeEnd("All files generated in ");
  }
}

let generateHaneler = async () => {
  await validateConfig();
  config.shouldRefresh = false;
  Promise.all([
    readAllData(),
    readAllPage(),
    readAllPost(),
    readAllLayout(),
    readTemplate(),
  ]).then(async (results) => {
    generate();
  }).catch((error) => {
    console.log(error)
  });
}

//#endregion


//#region -----clean phase-----

let clean = () => {
  console.time("Cleared public and db.json in ")
  Promise.all([
    fs.rm(allPaths.public, {
      recursive: true
    }).catch(() => {}),
    fs.unlink(allPaths.dbpath).catch(() => {}),
  ]).then(() => {
    console.timeEnd("Cleared public and db.json in ")
  });
}

//#endregion


//#region ----template file generator phase----

let create = (data) => {
  if (data.data) {
    let datafile = path.join(allPaths.data, data.data + ".json");
    let outputPath = path.join(allPaths.src, data.output || '');

    let templateFile = path.join(allPaths.pagegen, 'template.ejs');
    let programFile = path.join(allPaths.pagegen, 'template.js');

    fs.readFile(datafile, 'utf8').then((outputdata) => {
      outputdata = JSON.parse(outputdata);
      fs.readFile(programFile, 'utf8').then((outputProgram) => {
        fs.readFile(templateFile, 'utf8').then((outputTemplate) => {
          try {
            eval(outputProgram);
          } catch (error) {
            console.log(error);
          }
        }).catch(err => {
          console.log(err);
        });
      }).catch(err => {
        console.log(err);
      });
    }).catch(err => {
      console.log(err);
    });
  }
}

//#endregion


//#region ----new page----
let newpage = ()=>{
  let pagetype = "";
  let pagename = "";
  let outputPath = "";
}
//#endregion


//-----main-----
let picogen2 = () => {
  let args = processArguments();
  switch (args._[0]) {
    case "init":
      init();
      break;
    case "server":
      serverHandeler();
      break;
    case "generate":
      generateHaneler();
      break;
    case "clean":
      clean();
      break;
    case "create":
      create({
        data: args._[1],
        output: args._[2],
      });
      break;
    default:
      console.log("Invalid Option");
      break;
  }
}

// ----export----
module.exports = picogen2;