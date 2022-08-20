const fs = require('fs-extra')

let {
  allPaths,
} = require('./global/config')



module.exports = clean = () => {
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