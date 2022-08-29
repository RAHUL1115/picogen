const chalk = require('chalk');
const fs = require('fs-extra')
const path = require('path')
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');

let {
  config,
  allPaths
} = require('./global/config')




module.exports = preview = (doNotLog = false) => {

  app = new tinyApp();
  
  app.use(serveStatic(allPaths.public, {
    redirect: '',
    extensions: ["html"]
  }));

  server = app.listen(config.port);

  if (!doNotLog){
    console.log(chalk.green("INTO - Server is up and running at http://localhost:" + config.port));
  }
}