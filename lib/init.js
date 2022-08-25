const fs = require('fs-extra')

let {
  allPaths,
} = require('./global/config')


module.exports =  init = async () => {

  if (fs.existsSync(allPaths.src)) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log("\nDirectory Already exist this process will remove src directory and all its content.")
    readline.question(
      "Do you still want to continue(y/n) : ",
      async (output) => {
        if (output == "y" || output == "Y") {
          fs.rmSync(allPaths.src, {
            recursive: true
          });
          fs.copySync(allPaths.srcGlobal, allPaths.src)
          fs.copyFileSync(allPaths.configGlobal, allPaths.config)
          readline.close();
        } else {
          readline.close();
        }
      }
    );
  } else {
    await fs.mkdir(allPaths.src)
    fs.copySync(allPaths.srcGlobal, allPaths.src)
  }
}