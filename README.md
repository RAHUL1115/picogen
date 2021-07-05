# picogen

## What is this

picogen is a static site generator

## Features

- Fast generating
- ejs support
- live reload

## instalation

**Install Stag**

``` bash
$ npm i picogen
```

## setup
- create index.js file.
- Add this in your index.js file.
``` javascript
const pgen = require("picogen");
pgen();
``` 
- iniatilze stag (this will initaize and start the server)
``` bash
$ node index.js init
```
- server
``` bash
$ node index.js
```
- generate
``` bash
$ node index.js generate
```