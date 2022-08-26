const fs = require('fs-extra')
const path = require('path')
const tinyApp = require('@tinyhttp/app').App;
const serveStatic = require('serve-static');

let {
  config,
  allPaths
} = require('./global/config')




module.exports = preview = (doNotLog) => {

  app = new tinyApp();
  
  app.use(serveStatic(allPaths.public, {
    redirect: '',
    extensions: ["html"]
  }));

  server = app.listen(config.port);

  if(typeof(doNotLog) != 'undefined' && doNotLog == false){
    console.log("INTO - Server is up and running at http://localhost:" + config.port);
  }
}