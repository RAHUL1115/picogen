let {
  processArguments,
} = require('./global/config')

let init = require('./init')
let serverHandeler = require('./server');
let generateHaneler = require('./generate');
let preview = require('./preview');
let clean = require('./clean');
let create = require('./create');


let picogen = () => {
  let args = processArguments();
  switch (args._[0]) {
    case "init":
      init();
      break;
    case "server":
      serverHandeler();
      break;
    case "generate":
      generateHaneler();
      break;
    case "preview":
      preview();
      break
    case "clean":
      clean();
      break;
    case "create":
      create({
        data: args._[1],
        output: args._[2],
      });
      break;
    default:
      console.log("Invalid Option");
      break;
  }
}

// ----export----
module.exports = picogen