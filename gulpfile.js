const { src, dest, watch } = require("gulp");
const minifyCss = require("gulp-clean-css");
const concat = require("gulp-concat");
const minifyJs = require("gulp-uglify");

const cssfiles = "{fontawsome,splide,sal,odometer,tailwind,main}";
const jsfiles = "{alpine,splide,sal,odometer,main}";
const cssDest = "./public/css";
const jsDest = "./public/js";
// const cssDest = "./src/_static/css";
// const jsDest = "./src/_static/js";


const buildCss = () => {
  let csstask = src(`./src/_static/css/${cssfiles}.css`);
  csstask = csstask.pipe(
    minifyCss({
      level: {
        1: {
          specialComments: false,
        },
      },
    })
  );
  csstask = csstask.pipe(concat("bundle.css"));
  csstask = csstask.pipe(dest(cssDest));
  return csstask;
};

const buildJs = () => {
  let jstask = src(`./src/_static/js/${jsfiles}.js`);

  jstask = jstask.pipe(minifyJs());
  jstask = jstask.pipe(concat("bundle.js"));
  jstask = jstask.pipe(dest(jsDest));
  return jstask;
};

exports.buildcss = buildCss;
exports.buildjs = buildJs;