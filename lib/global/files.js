const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const ejs = require("ejs");
const csvjson = require('csvjson');
const Base64BufferThumbnail = require("base64-buffer-thumbnail-no-cache");
const sizeOf = require('image-size')

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
      console.log('non image file in _static/img')
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
    rej()
  })


});

let readAllData = () => new Promise(async (res, rej) => {
  // get all data file path
  let allDataFiles = await rra.list(allPaths.data, {
    readContent: true,
    encoding: 'utf-8'
  })

  if (allDataFiles.error) {
    allDataFiles = [];
  }

  // read all data files
  let dataJson = {};
  let dataCsv = {};

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
let readAllPage = () => new Promise(async (res, rej) => {
  // get all the files path
  let allPageFiles = await rra.list(allPaths.page, {
    readContent: true,
    encoding: 'utf-8'
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
    pageFiles.content.push(file.data);
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
let readAllLayout = (modifiedFile) => new Promise(async (res, rej) => {
  // read all layout files
  let allLaoutFiles
  let layoutFiles = {
    content: [],
    layout: {},
  }

  // read files
  if (typeof modifiedFile !== 'undefined'){
    layoutFiles.content.push(fs.readFile(modifiedFile, "utf8"));
    allLaoutFiles = [{
      fullname: modifiedFile
    }]
  }else{
    allLaoutFiles = await rra.list(allPaths.layout,{
      readContent: true,
      encoding: 'utf-8'
    })
    if (allLaoutFiles.error) {
      console.log(allLaoutFiles.error)
      console.log('no default layout found add default.ejs in layout folder');
      allLaoutFiles = [];
      process.exit(0);
    }


    allLaoutFiles.forEach((file) => {
      layoutFiles.content.push(file.data);
    })
  }


  // process and save the content in database
  Promise.all(layoutFiles.content).then((content) => {

    // push all the data form promise
    content.forEach((data, index) => {
      layoutFiles.layout[allFunction.processLayoutName(allLaoutFiles[index].fullname)] = allFunction.processTemplatandLaouteData(data);
    });

    // chek if the data is new or old
    if(db.has('layout')){
      db.set("layout", Object.assign(db.get('layout'), layoutFiles.layout));
    } else{
      db.set("layout", layoutFiles.layout);
    }

    // 
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

  let props = {
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
    let pagelayout = page.data?.layout ? (site.layout[page.data.layout] || site.layout.default.trim()) : site.layout.default.trim();

    body = ejs.render(pagelayout, Object.assign(props, {
      page,
      site: {
        data: site.data,
        csv: site.csv,
        pages: site.pages,
        posts: modifiedPagesAndPosts.posts,
      },
    }));

    body = !(page.data?.renderInLayout) ? body : ejs.render(body, Object.assign(props, {
      getNchar: allFunctionction.removeHtmlTags,
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
  return ejs.render(site.template.trim(), Object.assign(props, {
    body: body,
    page,
    site: {
      data: site.data,
      csv: site.csv,
      pages: site.pages,
      posts: site.posts,
      
    },
   
  }));
}

module.exports = {
  readImages,
  readAllData,
  readAllPage,
  readAllPost,
  readAllLayout,
  readTemplate,
  processPagesAndPosts,
}