# picogen

## What is this

picogen is a static site generator

## Features

- Fast generating
- ejs support
- live reload

## instalation

**Install picogen**

``` bash
$ npm install -g picogen
```

## setup & use
- create a project folder.
``` bash
$  mkdir new-project
``` 
- enter into the project folder.
``` bash
$ cd new-project
``` 
- iniatilze picogen (this will initaize the starter files and start the server)
``` bash
$ picogen init
```
- starting server (this will strat the server on a already created project)
``` bash
$ picogen
```
or
``` bash
$ picogen server
```
- generate (this will crete a new public folder with all the generated content);
``` bash
$ picogen generate
```
- clean (removes db.json and public/)
``` bash
$ picogen clean
```