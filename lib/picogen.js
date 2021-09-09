// ! imports
const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');
const ejs = require("ejs");
const watch = require("node-watch");

// ! variables
var allPaths = {
  data: path.join(path.resolve(), "src/_data").replace(/\\/g, "/"),
  component: path.join(path.resolve(), "src/_component") + "\\",
  layout: path.join(path.resolve(), "src/_template/layout").replace(/\\/g, "/"),
  static: path.join(path.resolve(), "src/_static").replace(/\\/g, "/"),
  page: path.join(path.resolve(), "src/pages").replace(/\\/g, "/"),
  template: path.join(path.resolve(), "src/_template/main.ejs").replace(/\\/g, "/"),
  dbpath: path.join(path.resolve(), "src/db.json").replace(/\\/g, "/"),
  public: path.join(path.resolve(), "public").replace(/\\/g, "/"),
  temp: path.join(path.resolve(), "src/.temp").replace(/\\/g, "/"),
  src: path.join(path.resolve(), "src").replace(/\\/g, "/"),
  srcGlobal: path.join(__dirname, "../src").replace(/\\/g, "/"),
  sitemap: path.join(path.resolve(), "public/sitemap.xml").replace(/\\/g, "/"),
  feed: path.join(path.resolve(), "public/feed.xml").replace(/\\/g, "/"),
  pagegen: path.join(path.resolve(), "src/_apagegen").replace(/\\/g, "/"),
}

let app;
let server;
let client;
let port = 4000;
let isRefreshedRecentely = false;
let shouldRefresh = true;
let shouldGenerateSitemap = false;
let shouldGenerateFeed = false;

// ! database
let db = new JSONdb(allPaths.dbpath, {
  jsonSpaces: 0,
});

// ! 
let processArguments = ()=>{
  const arg = require("arg");
  const args = arg({
    // Types
    '--sitemap': Boolean,
    '--feed': Boolean,
    '--noreload': Boolean,
    '--port': Number,

    '-s': '--sitemap',
    '-f': '--feed',
    '-n': '--noreload',
    '-p': '--port'
  }, 
  {
    permissive: false,
    argv : process.argv.slice(2),
  })
  shouldGenerateSitemap = args['--sitemap'];
  shouldGenerateFeed = args['--feed'];
  shouldRefresh = !args['--noreload'];
  port = args['--port'] || 4000;
  if (args._.length == 0){
    args._[0] = 'server';
  }
  return args;
}

// ! funcitons
// ? init related
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
          fs.rmdirSync(allPaths.src, {
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

// ? file Reading relaed
let readAllData = () => new Promise(async (res, rej) => {
  // get all data file path
  let allDataFiles = await rra.list(allPaths.data, {
    recursive: true,
  })

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
  // function
  function deepfinder(fileData) {
    let filepath = (fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html")).split('/');
    if (filepath.length == 2) {}
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
  }

  // process page data
  function processPageData(data, stat, fileData) {
    return {
      "data": matter(data).data,
      "srcfix": deepfinder(fileData),
      "name": path.basename(fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html")),
      "path": path.dirname(fileData.fullname.replace(allPaths.page, "")),
      "fullpath": fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html"),
      "actualpath": fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html"),
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/(include\()/g, '$1_path+'),
    }
  }

  // get all the files path
  let allPageFiles = await rra.list(allPaths.page)

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
          pageFiles.parsedContent.push(processPageData(data, stat[index], allPageFiles[index]))
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

let readAllLayout = () => new Promise(async (res, rej) => {
  // add include prefix and return modified content
  function processLayoutData(data) {
    return data.replace(/(include\()/g, '$1_path+');
  }

  // return file name
  function processLayoutName(name) {
    return name.replace(allPaths.layout + "/", "").replace(".ejs", "");
  }

  // get all layout file list
  let allLaoutFiles = await rra.list(allPaths.layout)

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
      layoutFiles.layout[processLayoutName(allLaoutFiles[index].fullname)] = processLayoutData(data);
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
    db.set("template", processTemplateData(data))
    res()
  }).catch((err) => {
    console.log(err);
    rej()
  })
});

// ? valifation and fix
let validation = ()=> new Promise((res,rej)=>{
  let site = db.JSON();
  if(!site.data?.sitedata){
    console.log("sitedata.json config file is missing");
    process.exit(1)
  }
  if(!site.data.sitedata.websiteurl){
    console.log("webiste url is not given");
    process.exit(1)
  }
  if (shouldGenerateFeed && !site.data.sitedata.feed) {
    console.log("your feed generation enable, but feed data isn't given in sitedata.json file.");
    process.exit(1)
  } else if (shouldGenerateFeed && typeof(site.data.sitedata.feed) != "object") {
    console.log("type of your feed data is inappropriate");
    process.exit(1)
  }

  site.pages.forEach((page, index) => {
    let actualpath = (site.data.sitedata.removehtmlext && page.name != 'index.html') ? page.actualpath.replace('.html', '') : page.actualpath;
    site.pages[index].actualpath = actualpath;
  });
  db.set('pages', site.pages);
  res(site);
});

// ? server related
let createServer = (doNotLog) => {
  app = new tinyApp();
  app.use((req, res, next) => {
    let result = req.url.match(/(.json|.ejs)/g)
    if (result) {
      return res.status(403).end('403 Forbidden')
    }
    next()
  }, serveStatic(allPaths.static));
  server = app.listen(port);
  if (!doNotLog) {
    console.log("Server is up and running at http://localhost:" + port);
  }
  if (shouldRefresh) {
    app.get('/_reload', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      });
      client = res;
      req.on('close', () => {
        client = null;
      });
    });
  }
}

let processPages = (site, page) => {
  function getNchar(str, n, max = 10) {
    let absN = 0;

    for (var i = 0; i < max; i++) {
      if (str[n + i] == ' ') {
        absN = n + i;
        return str.substring(0, absN);
      }
      absN = n + i;
    }
    return str.substring(0, absN);
  }

  function removeHtmlTags(str) {
    return str.replace(/(<([^>]+)>)/ig, '')
  }

  let body = null;
  let modifiedPages = JSON.parse(JSON.stringify(site)).pages;
  modifiedPages = modifiedPages.map(page => {
    page.content = undefined;
    return page;
  });

  // process pages
  try {
    let modifiedPage = JSON.parse(JSON.stringify(page));
    modifiedPage.content = undefined;
    page.content = (page.data?.renderInLayout) ? page.content.trim() : ejs.render(page.content.trim(), {
      getNchar,
      removeHtmlTags,
      page: modifiedPage,
      site: {
        data: site.data,
        pages: modifiedPages,
      },
      _path: allPaths.component,
    });
  } catch (err) {
    console.log(err);
  }

  // process layout
  try {
    let pagelayout = page.data?.layout ? (site.layout[page.data.layout] || site.layout.default.trim()) 
    : site.layout.default.trim();
    
    body = ejs.render(pagelayout, {
      getNchar,
      removeHtmlTags,
      page,
      site: {
        data: site.data,
        pages: site.pages,
      },
      _path: allPaths.component,
    });

    body = !(page.data?.renderInLayout) ? body : ejs.render(body, {
      getNchar,
      removeHtmlTags,
      page,
      site: {
        data: site.data,
        pages: site.pages,
      },
      _path: allPaths.component,
    });
  } catch (err) {
    console.log(err)
    body = page.content;
  }

  // live reload code
  body = shouldRefresh ? body.concat(`
    <script>
      var evtSource = new EventSource("http://localhost:${port}/_reload");
      evtSource.onerror = function (e) {
        evtSource.close()
        location.reload();
      };
    </script>
  `).trim() : body;

  // render template
  return ejs.render(site.template.trim(), {
    getNchar,
    removeHtmlTags,
    body: body,
    page,
    site: {
      data: site.data,
      pages: site.pages,
    },
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
        res.send(processPages(site, page, port));
      });
    }
    if (page.fullpath != "/index.html" && page.name == "index.html") {
      app.get(path.dirname(page.fullpath), (req, res) => {
        if (req._parsedUrl.pathname == path.dirname(page.fullpath)) {
          res.redirect(req._parsedUrl.pathname + '/');
        } else {
          res.send(processPages(site, page, port));
        }
      });
    }
    app.get(page.actualpath, (req, res) => {
      res.send(processPages(site, page, port));
    });
  });
}

let liveReload = () => {
  let clientinterval = setInterval(() => {
    if (client) {
      client.end();
      clearInterval(clientinterval);
      setTimeout(() => {
        isRefreshedRecentely = false;
      }, 500);
    }
  }, 50);
}

// ? listing chnages related
let watcher = () => {
  watch([allPaths.data, allPaths.component, allPaths.layout, allPaths.page, allPaths.template, allPaths.static], {
    recursive: true
  }, async (evt, name) => {
    let temp = await Promise.all([
      readAllData(),
      readAllPage(), 
      readAllLayout(), 
      readTemplate(), 
    ]);
    updateServer(await validation());
    if (shouldRefresh && !isRefreshedRecentely) {
      isRefreshedRecentely = true;
      liveReload();
    }
  });
}

// ? generate, sitemap and clean
let sitemapGen = (site) => new Promise((res, rej) => {
  let sitemap = '';
  sitemap += '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
  sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  site.pages.forEach((page)=>{
    if (!(page.data.noindex)) {
      let thispage = page.actualpath.replace('index.html','');

      let priority = (thispage == '/') 
        ? '1.0' 
        :(thispage.split('/').length == 2 || thispage.split('/')[thispage.split('/').length - 1] == '') 
          ? '0.80' 
          : '0.64';

      sitemap += '\n\t\<url>';
      sitemap += `\n\t\t<loc>${site.data.sitedata.websiteurl+thispage}</loc>`;
      sitemap += `\n\t\t<lastmod>${new Date(page.modified).toLocaleDateString().replace(/\//g,'-')}</lastmod>`;
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


// TODO create documentation
let feedGen = (site) => new Promise((res, rej)=>{
  function removeHtmlTags(str) {
    return str.replace(/(<([^>]+)>)/ig, '')
  }

  const Feed = require("feed").Feed;
  const feed = new Feed({
    title: site.data.sitedata.feed.title,
    description: site.data.sitedata.feed.description,
    link: site.data.sitedata.websiteurl,
    language: site.data.sitedata.feed.language || "en",
    image: site.data.sitedata.siteimage,
    favicon: site.data.sitedata.favicon,
    copyright: site.data.sitedata.feed.copyright,
  });
  site.pages.forEach((page)=>{
    if (page.data.article && !(page.data.noindex)) {
      let thispage = page.actualpath.replace('index.html','');
      feed.addItem({
        title : page.data?.title,
        description : page.data?.description,
        id: site.data.sitedata.websiteurl + thispage,
        link: site.data.sitedata.websiteurl + thispage,
        date: new Date(page.modified),
        image: (path.join(path.dirname(path.join(site.data.sitedata.websiteurl, page.fullpath)), page.srcfix + page.data?.image).replace(/\:\\/g, '://'))
        .replace(/\\/g, '/'),
        content: page.content.trim(),
        author : {
          name: page.data.author,
        },
      });
    }
  });
  fs.writeFile(allPaths.feed, feed.rss2()).then(() => {
    res();
  }).catch(() => {
    rej();
  })
});

let generate = async (preLoadedSite) => {
  let site = preLoadedSite || db.JSON();
  let dirs = [];
  let files = [];
  console.time("All files generated in ");
  site.pages.forEach(async (page) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, page.fullpath))).catch(() => {}));
    files.push(
      fs.writeFile(path.join(allPaths.public, page.actualpath),
      processPages(site, page, port, true)).catch(() => {})
    );
  });
  await Promise.all(dirs).catch((error) => {});
  await Promise.all([
    Promise.all(files).catch((error) => {}),
    fs.copy(allPaths.static, allPaths.public).catch((error) => {}),
  ]).catch((error) => {});

  if (shouldGenerateSitemap) {
    await sitemapGen(site);
    if (shouldGenerateFeed) {
      await feedGen(site);
      console.timeEnd("All files generated in ");
    }else{
      console.timeEnd("All files generated in ");
    }
  } else {
    console.timeEnd("All files generated in ");
  }
}

let clean = () => {
  console.time("Cleared public and db.json in ")
  Promise.all([
    fs.rmdir(allPaths.public, {
      recursive: true
    }).catch(() => {}),
    fs.unlink(allPaths.dbpath).catch(() => {}),
  ]).then(() => {
    console.timeEnd("Cleared public and db.json in ")
  });
}

// ? handeler
let serverHandeler = () => {
  Promise.all([
    readAllData(),
    readAllPage(),
    readAllLayout(),
    readTemplate(),
    db.JSON(),
  ]).then(async (results) => {
    let tempsite = await validation();
    createServer();
    updateServer(tempsite);
    watcher();
    results = undefined;
  }).catch((error) => {
    console.log(error)
  });
}

let generateHaneler = () => {
  shouldRefresh = false;
  Promise.all([
    readAllData(), 
    readAllPage(), 
    readAllLayout(), 
    readTemplate(),
  ]).then(async (results) => {
    generate(await validation());
  }).catch((error) => {
    console.log(error)
  });
}

// ? file creator
let create = (data) => {
  if (data.data) {
    let datafile = path.join(allPaths.data, data.data + ".json");
    let outputPath = path.join(allPaths.src, data.output || '');
    
    let templateFile = path.join(allPaths.pagegen, 'template.ejs');
    let programFile = path.join(allPaths.pagegen, 'index.js');

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

// ! main
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

module.exports = picogen2;