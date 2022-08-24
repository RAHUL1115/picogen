const fs = require('fs-extra')
const path = require('path')
const ejs = require("ejs");

let {
  allPaths,
} = require('./global/config')


module.exports = create = (data) => {

  if (data.data) {
    let dataFile = path.join(allPaths.data, data.data + ".json");
    let outputPath = path.join(allPaths.src, data.output || '');
    let templateFile = allPaths.create;

    fs.readFile(dataFile, 'utf8').then((outputData) => {
      outputData = JSON.parse(outputData);
      fs.readFile(templateFile, 'utf8').then((template) => {
        outputData.forEach((eachOutputData) => {
          let filePath = path.join(outputPath, eachOutputData.name + ".ejs");
          let folderPath = path.dirname(filePath);
          fs.mkdir(folderPath, { recursive: true }).then(() => {
            fs.writeFile(filePath, ejs.render(template, eachOutputData)).catch((err) => {
              console.log(err);
            });
          }).catch(err => {
            console.log(err)
          })
        })
      }).catch(err => {
        console.log(err);
      });
    }).catch(err => {
      console.log(err);
    });
  }
}