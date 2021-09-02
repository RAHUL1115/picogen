let data = outputdata.testArray;

fs.mkdir(outputPath, {recursive: true})
.then((output)=>{
  data.forEach((eachData)=>{
    let filePath = path.join(outputPath, eachData.name);
    fs.writeFile(filePath, ejs.render(outputTemplate,
      {...eachData}
    )).catch((err)=>{
      console.log(err);
    });
  })
}).catch(err=>{})