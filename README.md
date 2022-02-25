# Picogen

## What is this

picogen is a static site generator

## Features

- Fast generating
- ejs support
- live reload

## Instalation

**Install picogen**

``` bash
$ npm install -g picogen
```

## Setup
- create a project folder.
``` bash
$  mkdir new-project
``` 
- enter into the project folder.
``` bash
$ cd new-project
``` 

## Use
- iniatilze picogen (this will initaize the starter files)
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
- starting server with no auto reaload
``` bash
$ picogen server n
```
- generate (this will crete a new public folder with all the generated content);
``` bash
$ picogen generate
```
- generate files with sitemap (this will create a sitemap.xml in your public folder);
``` bash
$ picogen generate s
```
- clean (removes db.json and public/)
``` bash
$ picogen clean
```
more info [here](https://rahul1115.github.io/picogen/public/)