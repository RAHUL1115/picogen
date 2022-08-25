const fs = require('fs-extra')
const path = require('path')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const yaml = require('js-yaml');
const chalk = require('chalk');

// configs
let config = {
  port: 4000,
  isRefreshedRecently: false,
  shouldRefresh: true,
  production: false,
  refreshInterval: 500,
  waitForNewRefresh: 500,
  shouldWatch : true,
  
  websiteURL: "https://example.com",
  devUrl: "localhost:4000",
  imgOptimizer: "",
  cssFiles: "",
  jsFiles: "",
  purgeCss : false,
  postPath: "",
  removeHTMLExt: false,
  sitemap: false,
  feed: false,
  title: "",
  description: "",
  copyright: "",
  image: "",
  favicon: "",
};

// All paths
var allPaths = {
  configGlobal: path.join(__dirname, "../../picogen.yml").replace(/\\/g, "/"),
  config: path.join(path.resolve(), "picogen.yml").replace(/\\/g, "/"),
  srcGlobal: path.join(__dirname, "../../src").replace(/\\/g, "/"),
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
  public: path.join(path.resolve(), "public").replace(/\\/g, "/"),
  siteSearch: path.join(path.resolve(), "public/siteSearch.json").replace(/\\/g, "/"),
  sitemap: path.join(path.resolve(), "public/sitemap.xml").replace(/\\/g, "/"),
  feed: path.join(path.resolve(), "public/feed.xml").replace(/\\/g, "/"),
}

// All functions
let allFunction = {
  getNchar: (str, n = 100, max = 20) => {
    let lastBest = n + max
    for (let i = 0; i < max; i++) {
      if (str[n + i] === ' ') {
        lastBest = n + i;
      }
      if (str[n + i] === '.') {
        return str.substring(0, n + i);
      }
    }
    return str.substring(0, lastBest);
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
  href: (str) => {
    if (config.production) {
      return path.join(config.websiteURL, str);
    } else {
      return path.join(config.devUrl, str);
    }
  },
  src: (str) => {
    if (config.production) {
      let imgOptimizer = config.imgOptimizer + config.websiteURL;
      return path.join(imgOptimizer, str);
    } else {
      return path.join(config.devUrl, str);
    }
  },
  deepFinder: (fullpath) => {
    let filepath = fullpath.split('/');
    filepath = filepath.map((_splitPath, index) => {
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
    let actualname = (config.removeHTMLExt && name != 'index.html') ? name.replace('.html', '') : name;
    let actualpath = (config.removeHTMLExt && name != 'index.html') ? fullpath.replace('.html', '') : fullpath;
    return {
      "data": matter(data).data,
      "name": path.basename(fileData.fullname).replace(path.extname(fileData.name), ".html"),
      "path": path.dirname(fileData.fullname.replace(allPaths.page, "")),
      "fullpath": fullpath,
      "actualname": actualname,
      "actualpath": actualpath,
      "srcfix": "./",
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/(include\()/g, '$1_path+'),
    }
  },
  processPostData: (data, stat, fileData) => {
    let postPath = (path.join(path.dirname(fileData.fullname), config.postPath, path.basename(fileData.fullname))).replace(/\\/g, '/');

    let name = path.basename(postPath.replace(path.extname(fileData.name), ".html"))
    let fullpath = postPath.replace(allPaths.post, "").replace(path.extname(fileData.name), ".html")
    let actualname = (config.removeHTMLExt && name != 'index.html') ? name.replace('.html', '') : name;
    let actualpath = (config.removeHTMLExt && name != 'index.html') ? fullpath.replace('.html', '') : fullpath;
    return {
      "data": matter(data).data,
      "name": name,
      "path": path.dirname(postPath.replace(allPaths.post, "")),
      "fullpath": fullpath,
      "actualname": actualname,
      "actualpath": actualpath,
      "srcfix": "./",
      "created": matter(data).data.created || stat.birthtime,
      "modified": matter(data).data.modified || stat.ctime,
      "content": matter(data).content.replace(/(include\()/g, '$1_path+'),
    }
  },
  processTemplateLayoutData: (data) => {
    return data.replace(/(include\()/g, '$1_path+');
  },
  processLayoutName: (name) => {
    return name.replace(allPaths.layout + "/", "").replace(".ejs", "");
  },
  processSiteSearch: (allPages) => {
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

let processArguments = () => {
  const arg = require("arg");
  const args = arg({
    // Types
    '--noReload': Boolean,
    '--production': Boolean,
    '--interval': Number,
    '--port': Number,

    '-n': '--noReload',
    '-p': '--production',
    '-i': '--interval',
    '-P': '--port',
  }, {
    permissive: false,
    argv: process.argv.slice(2),
  })
  config.shouldRefresh = !args['--noReload'];
  config.port = args['--port'] || 4000;
  config.refreshInterval = args['--interval'] || config.refreshInterval;
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
    configData = fs.readFileSync(allPaths.config, 'utf8');
    configData = yaml.load(configData)
  } catch (error) {
    console.error(chalk.red("ERROR  Config file is missing Or there is an error in config file"))
    process.exit(0)
  }

  config.websiteURL = configData.websiteURL || config.websiteURL;
  config.devUrl = configData.devUrl || config.devUrl;
  config.removeHTMLExt = configData.removeHTMLExt || config.removeHTMLExt;
  config.imgOptimizer = configData.imgOptimizer || config.imgOptimizer;
  config.cssFiles = configData.cssFiles || config.cssFiles;
  config.jsFiles = configData.jsFiles || config.jsFiles;
  config.purgeCss = configData.purgeCss ? [path.join(allPaths.src, configData.purgeCss)] : config.purgeCss;
  config.postPath = configData.postPath || config.postPath;
  config.sitemap = configData.sitemap || config.sitemap;
  config.feed = configData.feed || config.feed;
  config.title = configData.title || config.title;
  config.description = configData.description || config.description;
  config.copyright = configData.copyright || config.copyright;
  config.image = configData.image || config.image;
  config.favicon = configData.favicon || config.favicon;

  db.set('config',config)
  res();
});

module.exports = {
  config,
  allPaths,
  allFunction,
  db,
  processArguments,
  validateConfig,
}