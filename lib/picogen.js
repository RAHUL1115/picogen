const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const ejs = require("ejs");
const csvjson = require('csvjson');
const Base64BufferThumbnail = require("base64-buffer-thumbnail-no-cache");

// configs
let config = {
  port: 4000,
  isRefreshedRecentely: false,
  shouldRefresh: true,
  shouldGenerateSitemap: false,
  shouldGenerateFeed: false,
  production: false,
  refreshIntervel: 500,
  waitForNewRefresh: 500,
  
  websiteurl: "https://example.com",
  devurl: "localhost:4000",
  imgOptimizer: "",
  postPath: "",
  removehtmlext: false,
  removehtmlextgen: false,
  title: "",
  description: "",
  copyright: "",
  image: "",
  favicon: "",
};

// All paths
var allPaths = {
  config: path.join(path.resolve(), "src/_data/sitedata.json").replace(/\\/g, "/"),
  srcGlobal: path.join(__dirname, "../src").replace(/\\/g, "/"),
  src: path.join(path.resolve(), "src").replace(/\\/g, "/"),
  create: path.join(path.resolve(), "src/_template/template.ejs").replace(/\\/g, "/"),
  component: path.join(path.resolve(), "src/_component") + "\\",
  csv: path.join(path.resolve(), "src/_data/_csv").replace(/\\/g, "/"),
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
    if (str.includes(':\\')) {
      str = str.replace(/:\\/g, '://');
    }
    return str.replace(/\\/g, '/')
  },
  href : (str) => {
    if (config.production) {
      return path.join(config.websiteurl, str);
    } else {
      return path.join(config.devurl, str);
    }
  },
  src : (str) => {
    if (config.production) {
      let imgOptimizer = config.imgOptimizer + config.websiteurl;
      return path.join(imgOptimizer, str);
    } else {
      return path.join(config.devurl, str);
    }
  },
  deepfinder: (fullpath) => {
    let filepath = fullpath.split('/');
    filepath = filepath.map((splitpath, index) => {
      if (index == 0 || index == 1) {
        if (filepath.length == 2) {
          return (index == 0)?"." : "/";
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
    let actualpath = (config.removehtmlext && name != 'index.html')?fullpath.replace('.html', '') : fullpath;
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
    let actualpath = (config.removehtmlext && name != 'index.html')?fullpath.replace('.html', '') : fullpath;
    return {
      "data": matter(data).data,
      "name": name,
      "path": path.dirname(postpath.replace(allPaths.post, "")),
      "fullpath": fullpath,
      "actualpath": actualpath,
      "srcfix": "./",
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
        ...page.data,
      });
    });
    return siteSearch;
  },
  imageToString: (src) => {
    return 
  }
}

// database
let db = new JSONdb(allPaths.dbpath, {
  jsonSpaces: 0,
});


//#region -----pre process----

// process arguments
let processArguments = () => {
  const arg = require("arg");
  const args = arg({
    // Types
    '--sitemap': Boolean,
    '--feed': Boolean,
    '--noreload': Boolean,
    '--production': Boolean,
    '--interval': Number,
    '--port': Number,

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

// validate config
let validateConfig = () => new Promise((res, rej) => {
  let configData;
  try {
    configData = fs.readFileSync(allPaths.config, {
      encoding: null
    });
    configData = JSON.parse(configData)
  } catch (error) {
    console.error("config file is missing Or there is an error in conig data")
    process.exit(0)
  }

  config.websiteurl = configData.websiteurl || config.websiteurl;
  config.devurl = configData.devurl || config.devurl;
  config.imgOptimizer = configData.imgOptimizer || config.imgOptimizer;
  config.postPath = configData.postPath || config.postPath;
  config.removehtmlext = configData.removehtmlext || config.removehtmlext;
  config.removehtmlextgen = configData.removehtmlextgen || config.removehtmlextgen;
  config.title = configData.title || config.title;
  config.description = configData.description || config.description;
  config.copyright = configData.copyright || config.copyright;
  config.image = configData.image || config.image;
  config.favicon = configData.favicon || config.favicon;
  res();
});

//#endregion


//#region ----readFiles phase----
let readImages = () => new Promise(async (res, rej) => {
  // get all the files path
  let images = await rra.list(allPaths.static, {
    readContent: true,
    include: ['.jpg', '.png', '.svg', '.jpeg']
  });
  if (images.error) {
    images = [];
  }

  imagesData = {
    name : [],
    data : [],
    output : {}
  }

  images.forEach(image => {
    imagesData.name.push(image.fullname)
    imagesData.data.push(Base64BufferThumbnail(image.data, { width: 20, responseType: "base64" }))
  })


  Promise.all(imagesData.data).then((data)=>{
    data.forEach((thumbnail,index) => {
      let name = imagesData.name[index].replace(allPaths.static+'/','')
      imagesData.output[name] = 'data:image/png;base64,' + thumbnail
    });
    db.set("images", imagesData.output);
    res();
  }).catch(err => {
    rej()
  })

  
});

let readAllData = () => new Promise(async (res, rej) => {
  // get all data file path
  let allDataFiles = await rra.list(allPaths.data,{
    readContent: true,
    encoding : 'utf-8'
  })

  if (allDataFiles.error) {
    allDataFiles = [];
  }

  // read all data files
  let dataJson = {};
  let dataCsv = {};

  allDataFiles.forEach((file) => {
    if(path.extname(file.name) == '.json'){
      return dataJson[file.name.replace(".json", "")] = JSON.parse(file.data)
    } 
    if(path.extname(file.name) == '.csv') {
      return dataCsv[file.name.replace(".csv", "")] = csvjson.toArray(file.data)
    }
  })


  db.set("data", dataJson)
  db.set("csv", dataCsv)
  res()
});

// read all pages
let readAllPage = () => new Promise(async (res, rej) => {
  // get all the files path
  let allPageFiles = await rra.list(allPaths.page,{
    readContent: true,
    encoding : 'utf-8'
  });
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

// read all posts
let readAllPost = () => new Promise(async (res, rej) => {
  // get all the files path
  let allPostFile = await rra.list(allPaths.post);
  if (allPostFile.error) {
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

// read layout
let readAllLayout = () => new Promise(async (res, rej) => {
  // get all layout file list
  let allLaoutFiles = await rra.list(allPaths.layout)
  if (allLaoutFiles.error) {
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

// read template
let readTemplate = () => new Promise(async (res, rej) => {
  // read and save the content in database
  fs.readFile(allPaths.template, "utf8").then((data) => {
    db.set("template", allFunction.processTemplatandLaouteData(data))
    res()
  }).catch((err) => {
    console.log("temoplate file is missing");
    process.exit(0)
  })
});

// process pages
let processPagesAndPosts = (site, page) => {
  let body = null;
  let modifiedPagesAndPosts = {
    pages: JSON.parse(JSON.stringify(site)).pages,
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
      href: allFunction.href,
      src: allFunction.src,
      page: modifiedPage,
      site: {
        data: site.data,
        csv: site.csv,
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
      href: allFunction.href,
      src: allFunction.src,
      page,
      site: {
        data: site.data,
        csv: site.csv,
        pages: site.pages,
        posts: modifiedPagesAndPosts.posts,
      },
      _production: config.production,
      _path: allPaths.component,
    });

    body = !(page.data?.renderInLayout) ? body : ejs.render(body, {
      getNchar: allFunction.getNchar,
      removeHtmlTags: allFunction.removeHtmlTags,
      href: allFunction.href,
      src: allFunction.src,
      page,
      site: {
        data: site.data,
        csv: site.csv,
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
    href: allFunction.href,
    src: allFunction.src,
    body: body,
    page,
    site: {
      data: site.data,
      csv: site.csv,
      pages: site.pages,
      posts: site.posts,
    },
    _production: config.production,
    _path: allPaths.component
  });
}

//#endregion

let init = require('./init')
let serverHandeler = require('./server');
let generateHaneler = require('./generate');
let preview = require('./preview');
let clean = require('./clean');
let create = require('./create');


let picogen2 = () => {
  let args = processArguments();
  switch (args._[0]) {
    case "init":
      init(allPaths);
      break;
    case "server":
      serverHandeler(config, validateConfig, readAllData, readImages, readAllPage, readAllPost, readAllLayout, readTemplate, processPagesAndPosts, allPaths, allFunction, db);
      break;
    case "generate":
      generateHaneler(config, validateConfig, readAllData, readImages, readAllPage, readAllPost, readAllLayout, readTemplate, processPagesAndPosts, allPaths, allFunction, db);
      break;
    case "preview":
      preview(config,allPaths);
      break
    case "clean":
      clean(allPaths);
      break;
    case "create":
      create({
        data: args._[1],
        output: args._[2],
      }, allPaths);
      break;
    default:
      console.log("Invalid Option");
      break;
  }
}

// ----export----
module.exports = picogen2;