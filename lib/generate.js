const fs = require('fs-extra')
const path = require('path')

let {
  config,
  allPaths,
  allFunction,
  db,
  validateConfig,
} = require('./global/config')


let {
  readImages,
  readData,
  readPage,
  readPost,
  readLayout,
  readTemplate,
  processPagesAndPosts,
} = require('./global/files')


let sitemapGen = (site) => new Promise((res, rej) => {
  let sitemap = '';
  sitemap += '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
  sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  [...site.pages, ...site.posts].forEach((page) => {
    if (!(page.data.draft)) {

      let priority = (page.URL == '/') ?
        '1.0' :
        (page.URL.split('/').length == 2 || page.URL.split('/')[page.URL.split('/').length - 1] == '') ?
          '1.0' :
          '0.80';

      sitemap += '\n\t\<url>';
      sitemap += `\n\t\t<loc>${config.websiteURL + page.URL}</loc>`;
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

let sitemapGen2 = () => new Promise((res,rej)=>{
  const preview = require('./preview')
  const SitemapGenerator = require('sitemap-generator');

  // start a preview server
  preview(true) 

  // create generator
  const generator = SitemapGenerator(`http://localhost:${config.port}`, {
    filepath: allPaths.sitemap,
    lastMod:true,
    stripQuerystring: true
  });

  generator.on('error', (error) => {
    console.log(error);
  });

  // register event listeners
  generator.on('done', () => {
    let sitemapContent = fs.readFileSync(allPaths.sitemap, 'utf8')
    let regex = new RegExp('http:\/\/localhost\:' + config.port, 'g')
    sitemapContent = sitemapContent.replace(regex, config.websiteURL)
    fs.writeFileSync(allPaths.sitemap, sitemapContent)
    res()
  });

  // start the crawler
  generator.start();
})

let feedGen = (site) => new Promise((res, rej) => {
  const Feed = require("feed").Feed;

  let feedData = {
    title: config.title,
    description: config.description,
    link: config.websiteURL,
    copyright: config.copyright,
  }
  if (config.image) {
    feedData.image = config.websiteURL + config.image;
  }
  if (config.favicon) {
    feedData.favicon = config.favicon;
  }

  const feed = new Feed(feedData);

  site.posts.forEach((page) => {
    if (!(page.data.draft)) {
      let FeedData = {
        title: page.data?.title || "",
        description: page.data?.description || "",
        id: config.websiteURL + page.URL,
        link: config.websiteURL + page.URL,
        date: new Date(page.created),
        content: page.content.trim(),
      }
      if (page.data?.image) {
        FeedData.image = config.websiteURL + page.data.image
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
  let siteSearch = allFunction.processSiteSearch([...site.pages, ...site.posts]);
  await fs.mkdir(allPaths.public).catch(() => { });
  await fs.writeFile(allPaths.siteSearch, JSON.stringify(siteSearch))
  res();
});

let gulpTask = () => {
  const gulp = require("gulp");
  const purgecss = require('gulp-purgecss')
  const csso = require('gulp-csso');
  const concat = require("gulp-concat");
  const minifyJs = require("gulp-uglify");
  const filter = require('gulp-filter');

  const cssFiles = (config.cssFiles.length > 1) ? `{${config.cssFiles.join()}}` : config.cssFiles.join();
  const jsFiles = (config.jsFiles.length) > 1 ? `{${config.jsFiles.join()}}` : config.jsFiles.join();
  const purgeFilter = filter([`**/{ _, ${config.purgeCssFiles.join()} }.css`], { restore: true });
  const cssDest = path.join(allPaths.public, 'css');
  const jsDest = path.join(allPaths.public, 'js');
  
  gulp.task('cssBuild', () => {
    let cssTask = gulp.src(path.join(allPaths.static, `css/${cssFiles}.css`));
    cssTask = cssTask.pipe(csso());
    if(config.purgeCss) {
      cssTask = cssTask.pipe(purgeFilter)
      cssTask = cssTask.pipe(purgecss({
        content: config.purgeCss
      }));
      cssTask = cssTask.pipe(purgeFilter.restore)
    }
    cssTask = cssTask.pipe(concat("bundle.css"));
    cssTask = cssTask.pipe(gulp.dest(cssDest));
    return cssTask;
  });
  gulp.task('jsBuild', () => {
    let jsTask = gulp.src(path.join(allPaths.static, `js/${jsFiles}.js`));
    jsTask = jsTask.pipe(minifyJs());
    jsTask = jsTask.pipe(concat("bundle.js"));
    jsTask = jsTask.pipe(gulp.dest(jsDest));
    return jsTask;
  });
  try {
    gulp.parallel(['cssBuild', 'jsBuild']).apply()
  } catch (error) {
    console.log(error);
  }
}

let generate = async (preLoadedSite) => {
  config.production = true;
  let site = preLoadedSite || db.JSON();
  let dirs = [];
  let files = [];
  let otherTasks = []


  console.time("All files generated in ");
  gulpTask();

  [...site.pages, ...site.posts].forEach((page) => {
    if (page.data.draft){
      return
    }
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, page.fullpath))).catch(() => { }));
    files.push(
      fs.writeFile(path.join(allPaths.public, page.fullpath),
        processPagesAndPosts(site, page)).catch(() => { })
    );
  });

  await Promise.all(dirs).catch((error) => { });
  await Promise.all([
    Promise.all(files).catch((error) => { }),
    fs.copy(allPaths.static, allPaths.public).catch((error) => { }),
  ]).catch((error) => { });

  // push the site search to otherTasks
  otherTasks.push(siteSearch(site))

  // add sitemap and feed to the otherTasks
  if (config.sitemap) {
    if(config.sitemap == 'crawl'){
      otherTasks.push(sitemapGen2());
    }
    else{
      otherTasks.push(sitemapGen(site));
    }
  }

  // feed generation
  if (config.feed) {
    otherTasks.push(feedGen(site));
  }

  await Promise.all(otherTasks).catch((error)=>{ })
  console.timeEnd("All files generated in ");

  process.exit(0);
}

module.exports = generateHandler = async () => {

  await validateConfig();
  config.shouldRefresh = false;
  Promise.all([
    readImages(),
    readData(),
    readPage(),
    readPost(),
    readLayout(),
    readTemplate(),
  ]).then(async (results) => {
    generate();
  }).catch((error) => {
    console.log(error)
  });
}