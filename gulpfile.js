'use strict'

const gulp = require('gulp');
const typescript = require('gulp-typescript');
const babel = require('gulp-babel');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const merge = require('merge-stream');
const tsfmt = require('gulp-tsfmt');
const tsconfigUpdate = require('gulp-tsconfig-files');
const tslint = require("gulp-tslint");

Error.stackTraceLimit = Infinity;

const tsconfig = typescript.createProject('tsconfig.json', { typescript: require('typescript') });
const tsCompileContext = ['./src/**/*.ts', './test/**/*.ts', './typings/tsd.d.ts'];
const tsSourceCode = ['src/**/*.ts', 'test/**/*.ts'];

// Available tasks:
// - clean
// - format
// - build
// - lint

gulp.task('default', ['lint']);

// clean generated files
gulp.task('clean', () => {
  return del(['lib', 'build', 'reports']);
});

// populate files array in tsconfig.json
gulp.task('tsconfig:files', function () {
  return gulp.src(tsCompileContext)
    .pipe(tsconfigUpdate({ posix: true }));
});

// reformat TypeScript source code
gulp.task('format', () => {
  return gulp.src(tsSourceCode, { base: "./" })
    .pipe(tsfmt({options: {IndentSize: 2}}))
    .pipe(gulp.dest('.'));
});

// TypeScript transpile
gulp.task('build', ['clean', 'format', 'tsconfig:files'], () => {
  const result = gulp.src(tsCompileContext)
    .pipe(sourcemaps.init())
    .pipe(typescript(tsconfig));
  const jsStream = result.js
    .pipe(babel({presets: ['es2015-node5']}))
    .pipe(sourcemaps.write('.', {includeContent:true, sourceRoot: './'}))
    .pipe(gulp.dest('./build'));
  const dtsStream = result.dts
    .pipe(gulp.dest('./build'));
  return merge(jsStream, dtsStream);
});


// lint (code checking)
gulp.task('lint', ['format'], () => {
  return gulp.src(tsSourceCode)
    // workaround of https://github.com/panuhorsmalahti/gulp-tslint/issues/55
    .pipe(tslint({rulesDirectory: 'node_modules/tslint-eslint-rules/dist/rules'}))
    .pipe(tslint.report('full', { summarizeFailureOutput: true, emitError: false}));
});
