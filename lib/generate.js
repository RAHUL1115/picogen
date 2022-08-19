const fs = require('fs-extra')
const path = require('path')

let config, validateConfig, readAllData, readImages, readAllPage, readAllPost, readAllLayout, readTemplate, processPagesAndPosts, allPaths, allFunction, db


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
      sitemap += `\n\t\t<loc>${site.data.sitedata.websiteurl + thispage}</loc>`;
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
    link: config.websiteurl,
    copyright: config.copyright,
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
        description: page.data?.description || "",
        id: config.websiteurl + thispage,
        link: config.websiteurl + thispage,
        date: new Date(page.created),
        content: page.content.trim(),
      }
      if (page.data?.image) {
        if (page.data?.image.includes('http://') || page.data?.image.includes('https://')) {
          FeedData.image = allFunction.fixSlash(page.data?.image);
        } else {
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
  await fs.mkdir(allPaths.public).catch(() => { });
  await fs.writeFile(allPaths.siteSearch, JSON.stringify(siteSearch))
  res();
});

let generate = async (preLoadedSite) => {
  let site = preLoadedSite || db.JSON();
  let dirs = [];
  let files = [];
  console.time("All files generated in ");
  site.pages.forEach(async (page) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, page.fullpath))).catch(() => { }));
    files.push(
      fs.writeFile(path.join(allPaths.public, config.removehtmlextgen ? page.actualpath : page.fullpath),
        processPagesAndPosts(site, page)).catch(() => { })
    );
  });
  site.posts.forEach(async (post) => {
    dirs.push(fs.mkdir(path.dirname(path.join(allPaths.public, post.fullpath))).catch(() => { }));
    files.push(
      fs.writeFile(path.join(allPaths.public, config.removehtmlextgen ? post.actualpath : post.fullpath),
        processPagesAndPosts(site, post)).catch(() => { })
    );
  });
  await Promise.all(dirs).catch((error) => { });
  await Promise.all([
    Promise.all(files).catch((error) => { }),
    fs.copy(allPaths.static, allPaths.public).catch((error) => { }),
  ]).catch((error) => { });

  await siteSearch(site);

  if (config.shouldGenerateSitemap || config.shouldGenerateFeed) {
    if (config.shouldGenerateSitemap) await sitemapGen(site);
    if (config.shouldGenerateFeed) await feedGen(site);
  } else {
    console.timeEnd("All files generated in ");
  }
}

module.exports = generateHaneler = async (_config, _validateConfig, _readAllData, _readImages, _readAllPage, _readAllPost, _readAllLayout, _readTemplate, _processPagesAndPosts, _allPaths, _allFunction, _db) => {
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