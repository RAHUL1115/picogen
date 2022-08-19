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

let allPaths


module.exports = clean = (_allPaths) => {
  allPaths = _allPaths

  console.time("Cleared public and db.json in ")
  Promise.all([
    fs.rm(allPaths.public, {
      recursive: true
    }).catch(() => { }),
    fs.unlink(allPaths.dbpath).catch(() => { }),
  ]).then(() => {
    console.timeEnd("Cleared public and db.json in ")
  });
}