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
  data: path.join(path.resolve(), "src/_data").replace(/\\/g,"/"),
  component: path.join(path.resolve(), "src/_component") + "\\",
  layout: path.join(path.resolve(), "src/_template/layout").replace(/\\/g,"/"),
  static: path.join(path.resolve(), "src/_static").replace(/\\/g,"/"),
  page: path.join(path.resolve(), "src/pages").replace(/\\/g,"/"),
  template: path.join(path.resolve(), "src/_template/main.ejs").replace(/\\/g,"/"),
  dbpath: path.join(path.resolve(), "src/db.json").replace(/\\/g,"/"),
  public: path.join(path.resolve(), "public").replace(/\\/g,"/"),
  temp: path.join(path.resolve(), "src/.temp").replace(/\\/g,"/"),
  src: path.join(path.resolve(), "src").replace(/\\/g,"/"),
  srcGlobal: path.join(__dirname, "../src").replace(/\\/g,"/"),
  sitemap: path.join(path.resolve(), "public/sitemap.xml").replace(/\\/g,"/"),
  feed: path.join(path.resolve(), "src/feed.xml").replace(/\\/g, "/"),
  pagegen: path.join(path.resolve(), "src/_apagegen").replace(/\\/g, "/"),
}
let app;
let server;
let client;
let port = 4000;
let isRefreshedRecentely = false;
let shouldRefresh = true;
let shouldGenerateSitemap = false;

// ! database
const db = new JSONdb(allPaths.dbpath, {
  jsonSpaces: 0
});

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
  function deepfinder(fileData){
    let filepath = (fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html")).split('/');
    filepath = filepath.map((splitpath, index) => {
      if (index == 0 || index == 1) {
        return "";
      }else{
        return "../";
      }
    });
    return filepath.join('');
  }

  // process page data
  function processPageData(data, stat, fileData) {
    return {
      "data": matter(data).data,
      "fullpath": fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html"),
      "srcfix": deepfinder(fileData),
      "path": path.dirname(fileData.fullname.replace(allPaths.page, "")),
      "name": path.basename(fileData.fullname.replace(allPaths.page, "").replace(path.extname(fileData.name), ".html")),
      "basename": path.basename(fileData.fullname.replace(allPaths.page, ""), path.extname(fileData.name)),
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/((<%-).+include\()/g,'$1_path+'),
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
    return data.replace(/((<%-).+include\()/g,'$1_path+');
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
    return data.replace(/((<%-).+include\()/g,'$1_path+');
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
  let body = null;
  let modifiedPages = JSON.parse(JSON.stringify(site)).pages;
  modifiedPages = modifiedPages.map(page => {
    page.content = undefined;
    return page;
  });
  try {
    let modifiedPage = JSON.parse(JSON.stringify(page));
    modifiedPage.content = undefined;
    page.content = ejs.render(page.content.trim(), {
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
  try {
    body = ejs.render(site.layout[page.data.layout], {
      page,
      site: {
        data: site.data,
        pages: site.pages,
      },
      _path: allPaths.component,
    });
  } catch (err) {
    try {
      body = ejs.render(site.layout.default.trim(), {
        page,
        site: {
          data: site.data,
          pages: site.pages,
        },
        _path: allPaths.component,
      });
    } catch (err) {
      body = page.content;
    }
  }
  body = shouldRefresh ? body.concat(`
    <script>
      var evtSource = new EventSource("http://localhost:${port}/_reload");
      evtSource.onerror = function (e) {
        evtSource.close()
        location.reload();
      };
    </script>
  `).trim() 
  : body;
  return ejs.render(site.template.trim(), {
    body: body,
    page,
    _path: allPaths.component,
    site: {
      data: site.data,
      pages: site.pages,
    }
  });
}

let updateServer = (preLoadedSite) => {
  let site = preLoadedSite || db.JSON();
  app.middleware = app.middleware.filter((route) => {
    return !(route.type == "route") || (route.path == "/_reload");
  });
  site.pages.forEach((page) => {
    let serverPath = (site?.data?.sitedata?.removehtmlext) ? page.basename :  page.fullpath;
    if (serverPath == "/index.html" || serverPath == "/index") {
      app.get("/", (req, res) => {
        res.send(processPages(site, page, port));
      });
    }
    if((serverPath != "/index.html" || serverPath != "/index") && page.name == "index.html"){
      app.get(path.dirname(page.fullpath), (req, res) => {
        res.send(processPages(site, page, port));
      });
    }
    app.get(serverPath, (req, res) => {
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
    await Promise.all([readAllData(), readAllPage(), readAllLayout(), readTemplate()])
    updateServer();
    if (shouldRefresh && !isRefreshedRecentely) {
      isRefreshedRecentely = true;
      liveReload();
    }
  });
}

// ? generate, sitemap and clean
let sitemapGen = (site) => new Promise((res, rej) => {
  console.time("sitemap generated in");
  createServer(true)
  updateServer(site);
  const SitemapGenerator = require('sitemap-generator');
  const generator = SitemapGenerator(`http://localhost:${port}`, {
    filepath: allPaths.sitemap,
    stripQuerystring: true,
    changeFreq: "daily",
    lastMod: true,
  });
  generator.on('done', () => {
    let data = fs.readFileSync(allPaths.sitemap, "utf8");
    data = data.toString();
    data = data.replace(new RegExp(`(http:\/\/localhost:${port})`, "g"), site.data?.sitedata?.websiteurl || '$1');
    fs.writeFileSync(allPaths.sitemap, data);
    console.timeEnd("sitemap generated in");
    res();
  });
  generator.on('error', (error) => {
    res(error);
  });
  generator.start();
});

let generate = async () => {
  let site = db.JSON();
  let dirs = [];
  let files = [];
  if (shouldGenerateSitemap) {
    sitemapGen(site).then(() => {
      server.close()
    }).catch((error) => {
      server.close()
      console.log(error)
    });
  }
  console.time("All files generated in ");
  site.pages.forEach(async (page) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, page.path))).catch(() => {}));
    files.push(fs.writeFile(path.join(allPaths.public, page.path), processPages(site, page, port,true)).catch(() => {}));
  });
  await Promise.all(dirs).catch((error) => {});
  await Promise.all([
    Promise.all(files).catch((error) => {}),
    fs.copy(allPaths.static, allPaths.public).catch((error) => {}),
  ]).catch((error) => {});
  console.timeEnd("All files generated in ");
}

let clean = () => {
  console.time("Cleared public and db.json in ")
  Promise.all([
     fs.rmdir(allPaths.public, {recursive: true }).catch(() => {}),
      fs.unlink(allPaths.dbpath).catch(() => {}),
  ]).then(()=>{
    console.timeEnd("Cleared public and db.json in ")
  });
}

// ? handeler
let serverHandeler = ()=>{
  Promise.all([
    readAllData(),
    readAllPage(),
    readAllLayout(),
    readTemplate()
  ]).then(()=>{
    shouldRefresh = process.argv[3]? process.argv[3] == "n" ? false : true : true;
    createServer();
    updateServer();
    watcher();
  });
}

let generateHaneler = ()=>{
  shouldGenerateSitemap = process.argv[3] ? process.argv[3] == "s" ? true : false : false;
  shouldRefresh = false;
  Promise.all([readAllData(), readAllPage(), readAllLayout(), readTemplate()])
  .then(()=>{
    generate();
  })
  .catch((error)=>{
    console.log(error)
  });
}

// ? file creator
let create = (data) => {
  if (data.data) {
    let datafile = path.join(allPaths.data, data.data+".json");
    let programFile = path.join(allPaths.pagegen, data.program || 'index.js');
    let templateFile = path.join(allPaths.pagegen, data.template || 'template.ejs');
    let outputPath = path.join(allPaths.src, data.output || '');
    
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
           console.log("no file found 1");
         });
      }).catch(err => {
        console.log("no file found 2");
      });
    }).catch(err => {
      console.log("no file found 3");
    });
  }
}

// ! main
let picogen2 = () => {
  switch (process.argv[2]) {
    case "init":
      init();
      break;
    case undefined:
      serverHandeler();
      break;
    case null:
      serverHandeler();
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
        data: process.argv[3],
        output: process.argv[4],
        program: process.argv[5],
        template: process.argv[6],
      });
      break;
    default:
      console.log("Invalid Option");
      break;
  }
}

picogen2();