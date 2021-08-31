const path = require('path')
const fs = require('fs')

let filepath = path.join(path.resolve(),'/test/picogen.js');
let libfilepath = path.join(path.resolve(), '/lib/picogen.js');

fs.readFile(filepath, 'utf8',(err,content)=>{
  content = content.split('picogen2();').join('module.exports = picogen2;')
  fs.writeFileSync(libfilepath,content,(err)=>{
    if (err){
      console.log(err);
    };
  });
});