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
  readAllData,
  readAllPage,
  readAllPost,
  readAllLayout,
  readTemplate,
  processPagesAndPosts,
} = require('./global/files')

let sitemapGen = (site) => new Promise((res, rej) => {
  let sitemap = '';
  sitemap += '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
  sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  [...site.pages, ...site.posts].forEach((page) => {
    if (!(page.data.draft)) {
      let thisPage = page.actualpath.replace('index.html', '');

      let priority = (thisPage == '/') ?
        '1.0' :
        (thisPage.split('/').length == 2 || thisPage.split('/')[thisPage.split('/').length - 1] == '') ?
          '0.80' :
          '0.64';

      sitemap += '\n\t\<url>';
      sitemap += `\n\t\t<loc>${config.websiteURL + thisPage}</loc>`;
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
    title: config.title,
    description: config.description,
    link: config.websiteURL,
    copyright: config.copyright,
  }
  if (config.image) {
    feedData.image = config.siteImage;
  }
  if (config.favicon) {
    feedData.favicon = config.favicon;
  }

  const feed = new Feed(feedData);

  site.posts.forEach((page) => {
    if (!(page.data.draft)) {
      let thisPage = page.actualpath;

      let FeedData = {
        title: page.data?.title || "",
        description: page.data?.description || "",
        id: config.websiteURL + thisPage,
        link: config.websiteURL + thisPage,
        date: new Date(page.created),
        content: page.content.trim(),
      }
      if (page.data?.image) {
        if (page.data?.image.includes('http://') || page.data?.image.includes('https://')) {
          FeedData.image = allFunction.fixSlash(page.data?.image);
        } else {
          FeedData.image = allFunction.fixSlash(
            path.join(
              path.join(config.websiteURL, page.path),
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

  const cssFiles = config.cssFiles || ""; // {'file1',file2} if multiple
  const jsFiles = config.jsFiles || ''; // 'file' if only one file
  const cssDest = path.join(allPaths.public, 'css');
  const jsDest = path.join(allPaths.public, 'js');
  
  gulp.task('cssBuild', () => {
    let cssTask = gulp.src(path.join(allPaths.static, `css/${cssFiles}.css`));
    cssTask = cssTask.pipe(csso());
    cssTask = cssTask.pipe(concat("bundle.css"));
    if(config.purgeCss) {
      cssTask = cssTask.pipe(purgecss({
        content: config.purgeCss
      }));
    }
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
  let site = preLoadedSite || db.JSON();
  let dirs = [];
  let files = [];
  console.time("All files generated in ");
  
  gulpTask();

  [...site.pages, ...site.posts].forEach(async (page) => {
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
  await siteSearch(site);

  if (config.sitemap) await sitemapGen(site);
  if (config.feed) await feedGen(site);
  console.timeEnd("All files generated in ");
}


module.exports = generateHandler = async () => {

  await validateConfig();
  config.shouldRefresh = false;
  Promise.all([
    readImages(),
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