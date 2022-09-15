# Picogen

## What is this

picogen is a static site generator

## Features

- Fast generating
- ejs support
- live reload

## Installation

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
- initialize picogen (this will initiate the starter files)
``` bash
$ picogen init
```
- starting server (this will start the server on a already created project)
``` bash
$ picogen
```
or
``` bash
$ picogen server
```
- starting server with no auto reload
``` bash
$ picogen server n
```
- generate (this will crete a new public folder with all the generated content);
``` bash
$ picogen generate
```
- clean (removes db.json and public/)
``` bash
$ picogen clean
```
more info [here](https://picogen.pages.dev)