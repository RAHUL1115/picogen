const fs = require("fs")
const path = require("path");
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const ejs = require("ejs");
const tinyApp = require('@tinyhttp/app').App
const serveStatic = require('serve-static')
const watch = require("node-watch");

// ? data
const db = new JSONdb("db.json");
let site = {
  data: {},
  pages: [],
  layoutdata: {},
  mainTemlate: null,
  otherfiles: [],
};

// server
let app;
let client;

// ? functions
let walkSync = function (dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      if (file == "_component" || file == "_data") return;
      filelist = walkSync(path.join(dir, file), filelist);
    } else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

let createFiles = () => {
  let data = JSON.stringify({
    "data1": "data"
  });
  fs.rmdirSync(path.join(path.resolve(), "source"), {
    recursive: true
  });
  fs.rmdirSync(path.join(path.resolve(), "template"), {
    recursive: true
  });

  fs.mkdirSync(path.join(path.resolve(), "source/_component"), {
    recursive: true
  });
  fs.mkdirSync(path.join(path.resolve(), "source/_data"), {
    recursive: true
  });
  fs.mkdirSync(path.join(path.resolve(), "source/css"), {
    recursive: true
  });

  fs.mkdirSync(path.join(path.resolve(), "template/layout"), {
    recursive: true
  });

  fs.writeFileSync(path.join(path.resolve(), "source/_component/component1.ejs"), "<p>component1</p>");
  fs.writeFileSync(path.join(path.resolve(), "source/_data/data1.json"), data);
  fs.writeFileSync(path.join(path.resolve(), "source/css/main.css"), `p{
  color:blue
}
  `);
  fs.writeFileSync(path.join(path.resolve(), "source/index.ejs"), "<p>this is main file</p>");

  fs.writeFileSync(path.join(path.resolve(), "template/layout/default.ejs"), "<%- include('component1') %>\n<%- page.content %>");
  fs.writeFileSync(path.join(path.resolve(), "template/main.ejs"), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <link rel="stylesheet" href="css/main.css">
</head>
<body>
  <%- body %>
</body>
</html>
  `);
}

let init = async () => {
  let tempexist = fs.existsSync(path.join(path.resolve(), "template"))
  let sourcexist = fs.existsSync(path.join(path.resolve(), "source"))
  if (tempexist || sourcexist) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log("\nDirectory Already exist this process will remove template and source directory and all its content.")
    readline.question(
      "Do you still want to continue(y/n) : ",
      (output) => {
        if (output == "y" || output == "Y") {
          readline.close();
          createFiles();
          readMainTemplate();
          readAllData();
          readAllSourceFile();
          readAllLayout();
          processDB();
          serve(4000, true)
          fileWatcher();
        } else {
          readline.close();
        }
      }
    );
  } else {
    createFiles();
    readMainTemplate();
    readAllData();
    readAllSourceFile();
    readAllLayout();
    processDB();
    serve(4000, true)
    fileWatcher();
  }
};

let readMainTemplate = () => {
  site.mainTemlate = fs.readFileSync(path.join(path.resolve(), "template/main.ejs"), "utf8")
    .replace(/((<%-|<%=).+include\()(("|'|`).+)(("|'|`)\).+%>)/g, '$1_path+$3$5')
}

let readAllData = () => {
  const readData = (fileName) => JSON.parse(fs.readFileSync(fileName));
  let dataFilesList = walkSync(path.join(path.resolve(), "source/_data"));
  site.data = {};
  dataFilesList.forEach((datas) => {
    if (path.extname(datas) == ".json") {
      let name = path.basename(datas).replace(".json", "");
      site.data[name] = readData(datas);
    }
  });
}

let readAllSourceFile = () => {
  const readFile = (filename) => {
    const rawFile = fs.readFileSync(filename, "utf8");
    const fileStat = fs.statSync(filename, "utf8");
    const parsed = matter(rawFile);
    if (parsed.data.layout == undefined) {
      parsed.data.layout = "default";
    }
    return {
      path: filename.replace(path.join(path.resolve(), 'source'), "").split("\\").join("/").replace('.ejs', '.html'),
      sourcePath: filename.replace(path.resolve(), "").split("\\").join("/").replace('.ejs', '.html'),
      fullPath: filename.split("\\").join("/").replace('.ejs', '.html'),
      name: path.basename(filename),
      creted: fileStat.birthtime,
      modified: fileStat.ctime,
      data: parsed.data,
      content: parsed.content.replace(/((<%-|<%=).+include\()(("|'|`).+)(("|'|`)\).+%>)/g, '$1_path+$3$5'),
    };
  };
  let sourceFilesList = walkSync(path.join(path.resolve(), "source"));
  site.pages = [];
  site.otherfiles = [];
  sourceFilesList.forEach((files) => {
    if (path.extname(files) == ".ejs" || path.extname(files) == ".html") {
      let fileData = readFile(files);
      site.pages.push(fileData)
    } else {
      let fullPath = files.split("\\").join("/");
      let filePath = path.resolve(fullPath).replace(path.join(path.resolve(), 'source'), '').split("\\").join("/");
      site.otherfiles.push({
        fullPath,
        filePath
      });
    }
  });
}

let readAllLayout = () => {
  const readLayout = (layoutname) => {
    const content = fs.readFileSync(layoutname, "utf8");
    let name = path.resolve(layoutname).replace(path.join(path.resolve(), "template/layout") + "\\", '').replace(".ejs", '').split("\\").join("/");
    return {
      name,
      content: content.replace(/((<%-|<%=).+include\()(("|'|`).+)(("|'|`)\).+%>)/g, '$1_path+$3$5')
    };
  };
  let layoutFilesList = walkSync(path.join(path.resolve(), "template/layout"));
  site.layoutdata = {};
  layoutFilesList.forEach((layout) => {
    if (path.extname(layout) == ".ejs") {
      let data = readLayout(layout);
      site.layoutdata[data.name] = data;
    }
  });
}

let processDB = () => {
  for (let index = 0; index < site.pages.length; index++) {
    site.pages[index].content = ejs.render(site.pages[index].content, {
      site,
      _path: path.join(path.resolve(), "source/_component/"),
    });
  }
  db.set("site", {
    data: site.data,
    pages: site.pages
  });
  db.set("layout", site.layoutdata);
  db.set("main", site.mainTemlate);
  db.set("static", site.otherfiles);
}

let generate = () => {
  db.get("site").pages.forEach((page) => {
    let body = null;
    try {
      body = ejs.render(db.get("layout")[page.data.layout].content, {
        page,
        site: db.get("site"),
        _path: path.join(path.resolve(), "source/_component/"),
      });
    } catch (err) {
      body = ejs.render(db.get("layout").default.content, {
        page,
        site: db.get("site"),
        _path: path.join(path.resolve(), "source/_component/"),
      });
    }
    let content = ejs.render(db.get("main"), {
      page,
      site: db.get("site"),
      _path: path.join(path.resolve(), "source/_component/"),
      body,
    })
    try {
      let filePath = path.join(path.resolve(), "/public" + page.path);
      let folderPath = filePath.replace(path.basename(filePath), "")
      fs.mkdirSync(folderPath, {
        recursive: true
      })
      fs.writeFileSync(filePath, content)
    } catch (err) {
      console.error(err)
    }
  });
  db.get("static").forEach((file) => {
    let folderPath = path.join(path.resolve(), "public" + file.filePath.replace(path.basename(file.filePath), ""));
    fs.mkdirSync(folderPath, {
      recursive: true
    })
    fs.copyFileSync(file.fullPath, path.join(path.resolve(), "public" + file.filePath))
  });
}

let clean = () => {
  let dirPath = path.join(path.resolve(), "public");
  let dbPath = path.join(path.resolve(), "db.json");
  fs.rmdirSync(dirPath, {
    recursive: true
  });
  try {
    fs.unlinkSync(dbPath);
  } catch (err) {}
}

let sholdReload = () => {
  if (process.argv[3]) {
    if (process.argv[3] == "n" || process.argv[3] == "N") return false;
    return true;
  }
  return true;
}

let liveReaload = () => {
  let clientinterval = setInterval(() => {
    if (client) {
      client.end();
      clearInterval(clientinterval);
    }
  }, 50);
}

let serve = (port, first) => {
  let site = db.get("site");
  let layout = db.get("layout");
  let main = db.get("main");
  let modifyContent = (content) => {
    if (sholdReload()) {
      return content = content.concat(`
      <script>
        var evtSource = new EventSource("http://localhost:${port}/_reload");
        evtSource.onerror = function (e) {
          evtSource.close()
          location.reload();
        };
      </script>
    `);
    }
    return content;
  }
  let createRoute = (app, page, content) => {
    if (page.path == '/index.html') {
      app.get('/', (req, res) => {
        res.send(content);
      });
    }
    app.get(page.path, (req, res) => {
      res.send(content);
    });
  }
  if (first) {
    app = new tinyApp();
    app.use((req, res, next) => {
      let result = req.url.match(/(.json|.ejs)/g)
      if (result) {
        return res.status(403).end('403 Forbidden')
      }
      next()
    }, serveStatic('source'));
    if (sholdReload()) {
      app.get('/_reload', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        });
        res.write('you are subscribed');
        req.on('close', () => {
          client = null;
        });
        client = res;
      });
    }
    app.listen(port);
    console.log(`Developement server is running on : http://localhost:${port}`);
  }
  app.middleware = app.middleware.filter((route) => {
    return !(route.type == "route") || (route.path == "/_reload");
  });
  site.pages.forEach((page) => {
    let body = null;
    try {
      body = ejs.render(layout[page.data.layout].content, {
        page,
        site: site,
        _path: path.join(path.resolve(), "source/_component/"),
      });
    } catch (err) {
      try {
        body = ejs.render(layout.default.content, {
          page,
          site: site,
          _path: path.join(path.resolve(), "source/_component/"),
        });
      } catch (err) {
        body = page.content;
      }
    }
    let content = ejs.render(main, {
      page,
      site: site,
      _path: path.join(path.resolve(), "source/_component/"),
      body,
    })
    content = modifyContent(content);
    createRoute(app, page, content)
  });
}

let fileWatcher = () => {
  let conponentPath = path.join(path.resolve(), 'source/_component').split('\\').join('/');
  let dataPath = path.join(path.resolve(), 'source/_data').split('\\').join('/');
  let sourcePath = path.join(path.resolve(), 'source').split('\\').join('/');
  let layoutPath = path.join(path.resolve(), 'template/layout').split('\\').join('/');
  let mainPath = path.join(path.resolve(), 'template/main.ejs').split('\\').join('/');
  let dbPath = path.join(path.resolve(), 'db.json').split('\\').join('/');
  watch([path.join(path.resolve(), 'source/'), path.join(path.resolve(), 'template/'), path.join(path.resolve(), 'db.json')], {
    recursive: true
  }, (evt, name) => {
    name = name.split('\\').join('/')
    if (name.match(conponentPath)) {
      readAllSourceFile();
      processDB();
    } else if (name.match(dataPath)) {
      readAllData();
      processDB();
    } else if (name.match(sourcePath)) {
      readAllSourceFile();
      processDB();
    } else if (name.match(layoutPath)) {
      readAllLayout();
      processDB();
    } else if (name.match(mainPath)) {
      readMainTemplate();
      processDB();
    } else if (name.match(dbPath) && evt == "remove") {
      processDB()
    }
    serve(4000)
    if(sholdReload()) liveReaload();
  });
}

var picogen = function () {
  if (process.argv[2] == "clean") {
    console.time();
    clean();
    console.log("cleared Public folder in")
    console.timeEnd();
  } else if (process.argv[2] == "init") {
    init();
  } else {
    console.time()
    readMainTemplate();
    readAllData();
    readAllSourceFile();
    readAllLayout();
    processDB();
    if (process.argv[2] == "generate") {
      generate();
      console.log("generated Files in")
      console.timeEnd()
    } else {
      serve(4000, true)
      fileWatcher();
      console.log("server started in")
      console.timeEnd()
    }
  }

};

module.exports = picogen;