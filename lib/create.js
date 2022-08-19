const fs = require('fs-extra')
const path = require('path')
const ejs = require("ejs");

let allPaths

module.exports = create = (data, _allPaths) => {
  allPaths = _allPaths

  if (data.data) {
    let datafile = path.join(allPaths.data, data.data + ".json");
    let outputPath = path.join(allPaths.src, data.output || '');
    let templateFile = allPaths.create;

    fs.readFile(datafile, 'utf8').then((outputdata) => {
      outputdata = JSON.parse(outputdata);
      fs.readFile(templateFile, 'utf8').then((template) => {
        outputdata.forEach((eachoutputdata) => {
          let filePath = path.join(outputPath, eachoutputdata.name + ".ejs");
          let folderPath = path.dirname(filePath);
          fs.mkdir(folderPath, { recursive: true }).then(() => {
            fs.writeFile(filePath, ejs.render(template, eachoutputdata)).catch((err) => {
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