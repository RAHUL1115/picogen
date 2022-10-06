const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const ejs = require("ejs");
const csvjson = require('csvjson');
const Base64BufferThumbnail = require("base64-buffer-thumbnail-no-cache");
const sizeOf = require('image-size')
const minify = require('html-minifier').minify;

let {
  config,
  allPaths,
  allFunction,
  db,
} = require('./config')


let readImages = () => new Promise(async (res, rej) => {
  // get all the files path
  let images = await rra.list(path.join(allPaths.static,'img'), {
    readContent: true,
    include: ['.jpg', '.png', '.svg', '.jpeg']
  });
  if (images.error) {
    images = [];
  }

  imagesData = {
    name: [],
    data: [],
    size: [],
    output: {}
  }

  images.forEach(image => {
    try {
      imagesData.name.push(image.fullname)
      imagesData.data.push(Base64BufferThumbnail(image.data, { width: 20, responseType: "base64" }))
      imagesData.size.push(sizeOf(Buffer.from(image.data, 'base64')))
    }catch(err){
      console.log(err)
    }
  })
  
  Promise.all(imagesData.data).then((thumbnails) => {
    thumbnails.forEach((thumbnail, index) => {
      let name = imagesData.name[index].replace(allPaths.static + '/', '')
      imagesData.size[index].ratio = imagesData.size[index].width / imagesData.size[index].height
      imagesData.output[name] = { 
        src: 'data:image/' + imagesData.size[index].type +';base64,' + thumbnail, 
        size: imagesData.size[index]
      }
    });
    db.set("img", imagesData.output);
    res();
  }).catch(err => {
    rej(err)
  })


});

let readData = (modifiedFile) => new Promise(async (res, rej) => {
  // get all data file path
  let allDataFiles
  let dataJson = {};
  let dataCsv = {};


  if (typeof modifiedFile !== 'undefined') {
    allDataFiles = [{
      name: path.basename(modifiedFile),
      data: await fs.readFile(modifiedFile, "utf8")
    }];
  }else{
    allDataFiles = await rra.list(allPaths.data, {
      readContent: true,
      encoding: 'utf-8'
    })
    if (allDataFiles.error) {
      allDataFiles = [];
    }
  }
  

  allDataFiles.forEach((file) => {
    if (path.extname(file.name) == '.json') {
      return dataJson[file.name.replace(".json", "")] = JSON.parse(file.data)
    }
    if (path.extname(file.name) == '.csv') {
      return dataCsv[file.name.replace(".csv", "")] = csvjson.toArray(file.data)
    }
  })


  db.set("data", dataJson)
  db.set("csv", dataCsv)
  res()
});

// read all pages
let readPage = (modifiedFile) => new Promise(async (res, rej) => {
  // get all the files path
  let allPageFiles
  let pageFiles = {
    content: [],
    stat: [],
    parsedContent: [],
  }

  if (typeof modifiedFile !== 'undefined') {
    console.log('running')
    allPageFiles = [{
      name: path.basename(modifiedFile),
      fullname: modifiedFile
    }]
    pageFiles.content.push(await fs.readFile(modifiedFile, "utf8"));
    pageFiles.stat.push(fs.stat(modifiedFile));

  } else {

    allPageFiles = await rra.list(allPaths.page, {
      readContent: true,
      encoding: 'utf-8'
    });
    if (allPageFiles.error) {
      allPageFiles = [];
    }
    allPageFiles.forEach((file) => {
      pageFiles.content.push(file.data);
      pageFiles.stat.push(fs.stat(file.fullname));
    })

  }


  // process all files and save in database
    Promise.all(pageFiles.stat).then((stat) => {
      pageFiles.content.forEach((data, index) => {
        if (path.extname(allPageFiles[index].name) == ".ejs" || path.extname(allPageFiles[index].name) == ".html") {
          let pageJSON = allFunction.processPageData(data, stat[index], allPageFiles[index])
          pageJSON.srcfix = allFunction.deepFinder(pageJSON.fullpath);
          pageFiles.parsedContent.push(pageJSON)
        }
      });
      db.set("pages", pageFiles.parsedContent)
      res();
    }).catch((err) => {
      console.log(err);
      rej(err)
    })
  
});

// read all posts
let readPost = (modifiedFile) => new Promise(async (res, rej) => {
  // get all the files path
  let allPostFile
  let postFiles = {
    content: [],
    stat: [],
    parsedContent: [],
  };

  if (typeof modifiedFile !== 'undefined') {
    allPostFile = [{
      name: path.basename(modifiedFile),
      fullname: modifiedFile
    }]
    postFiles.content.push(await fs.readFile(modifiedFile, "utf8"));
    postFiles.stat.push(fs.stat(modifiedFile));
  } else {
    allPostFile = await rra.list(allPaths.post, {
      readContent: true,
      encoding: 'utf-8'
    });
    if (allPostFile.error) {
      allPostFile = [];
    }

    // read all files
    allPostFile.forEach((file) => {
      postFiles.content.push(file.data);
      postFiles.stat.push(fs.stat(file.fullname));
    });
  }
  

  // process all files and save in database
  Promise.all(postFiles.stat).then((stat) => {
    postFiles.content.forEach((data, index) => {
      if (path.extname(allPostFile[index].name) == ".ejs" || path.extname(allPostFile[index].name) == ".html") {
        let postJSON = allFunction.processPostData(data, stat[index], allPostFile[index])
        postJSON.srcfix = allFunction.deepFinder(postJSON.fullpath);
        postFiles.parsedContent.push(postJSON);
      }
    });
    db.set("posts", postFiles.parsedContent);
    res();
  })
  .catch((err) => {
    console.log(err);
    rej(err);
  });
});

// read layout
let readLayout = (modifiedFile) => new Promise(async (res, rej) => {
  // read all layout files
  let allLayoutFiles
  let layoutFiles = {
    content: [],
    layout: {},
  }

  // read files
  if (typeof modifiedFile !== 'undefined'){
    layoutFiles.content.push(fs.readFile(modifiedFile, "utf8"));
    allLayoutFiles = [{
      fullname: modifiedFile
    }]
  }else{
    allLayoutFiles = await rra.list(allPaths.layout,{
      readContent: true,
      encoding: 'utf-8'
    })
    if (allLayoutFiles.error) {
      console.log(allLayoutFiles.error+'error layout')
      console.log('no default layout found add default.ejs in layout folder');
      allLayoutFiles = [];
      process.exit(0);
    }

    allLayoutFiles.forEach((file) => {
      layoutFiles.content.push(file.data);
    })
  }


  // process and save the content in database
  Promise.all(layoutFiles.content).then((content) => {

    // push all the data form promise
    content.forEach((data, index) => {
      layoutFiles.layout[allFunction.processLayoutName(allLayoutFiles[index].fullname)] = allFunction.processTemplateLayoutData(data);
    });

    // check if the data is new or old
    if(db.has('layout')){
      db.set("layout", Object.assign(db.get('layout'), layoutFiles.layout));
    } else{
      db.set("layout", layoutFiles.layout);
    }
    res()
  }).catch((err) => {
    console.log(err);
    rej(err)
  })
});

// read template
let readTemplate = () => new Promise(async (res, rej) => {
  // read and save the content in database
  fs.readFile(allPaths.template, "utf8").then((data) => {
    db.set("template", allFunction.processTemplateLayoutData(data))
    res()
  }).catch((err) => {
    console.log("template file is missing");
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
  let props = {
    config,
    getNchar: allFunction.getNchar,
    removeHtmlTags: allFunction.removeHtmlTags,
    href: allFunction.href,
    src: allFunction.src,
    img: site.img,
    _production: config.production,
    _path: allPaths.component,
  }

  // process pages
  try {
    let modifiedPage = JSON.parse(JSON.stringify(page));
    modifiedPage.content = undefined;
    page.content = (page.data?.renderInLayout) ? page.content.trim() : ejs.render(page.content.trim(), Object.assign(props, {
      page: modifiedPage,
      site: {
        data: site.data,
        csv: site.csv,
        pages: modifiedPagesAndPosts.pages,
        posts: modifiedPagesAndPosts.posts,
      },
    }));
  } catch (err) {
    console.log(err);
  }

  // process layout
  try {
    let pageLayout = page.data?.layout ? (site.layout[page.data.layout] || site.layout.default.trim()) : site.layout.default.trim();

    body = ejs.render(pageLayout, Object.assign(props, {
      page,
      site: {
        data: site.data,
        csv: site.csv,
        pages: site.pages,
        posts: modifiedPagesAndPosts.posts,
      },
    }));

    body = !(page.data?.renderInLayout) ? body : ejs.render(body, Object.assign(props, {
      getNchar: allFunction.removeHtmlTags,
      page,
      site: {
        data: site.data,
        csv: site.csv,
        pages: site.pages,
        posts: site.posts,
      },
    }));
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
  body = ejs.render(site.template.trim(), Object.assign(props, {
    body: body,
    page,
    site: {
      data: site.data,
      csv: site.csv,
      pages: site.pages,
      posts: site.posts,
    },
  }));

  body = minify(body, {
    removeAttributeQuotes: false,
    removeComments: true,
    removeTagWhitespace : true,
    collapseWhitespace:true,
    preserveLineBreaks:true,
  });
  return body
}

module.exports = {
  readImages,
  readData,
  readPage,
  readPost,
  readLayout,
  readTemplate,
  processPagesAndPosts,
}