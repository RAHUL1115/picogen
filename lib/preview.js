const fs = require('fs-extra')
const path = require('path')
const rra = require('recursive-readdir-async')
const matter = require("gray-matter");
const JSONdb = require("simple-json-db");
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');
const ejs = require("ejs");
const watch = require("node-watch");
const csvjson = require('csvjson');
const {
  exit
} = require('process');

let app;
let server;
let config, allPaths

module.exports = preview = (_config, _allPaths) => {
  config = _config
  allPaths = _allPaths

  app = new tinyApp();
  let setHeaders = (res, Path) => {
    if (path.extname(Path) == "") {
      res.setHeader('content-type', 'text/html; charset=UTF-8')
    }
  }
  app.use(serveStatic(allPaths.public, {
    setHeaders: setHeaders,
    extensions: ["html"]
  }));
  server = app.listen(config.port);
  console.log("Server is up and running at http://localhost:" + config.port);
}