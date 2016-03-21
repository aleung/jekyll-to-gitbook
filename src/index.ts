import * as R from 'ramda'
import * as _glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';

function promisify<T>(f: Function) {
  return (...args) =>
    new Promise<T>((resolve, reject) => f(...args, (err, data: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    }));
}


const glob = R.curry(
  (pattern: string, path: string) =>
    promisify<string[]>(_glob)(pattern, { root: path })
);


function printFileName(file: string) {
  console.log(`Convert ${file}`);
  return file;
}

function catchError(ignore, err) {
  if (err) {
    console.log(err);
  }
}

const mkdir = promisify<void>(fs.mkdir);
const mv = promisify<void>(fs.rename);

const filterNotMove = R.curry((patterns: string[], file: string) => {
  const {name} = path.parse(file);
  return !R.contains(name, patterns);
});

async function moveToIndex(file: string) {
  const {root, dir, name, ext} = path.parse(file);
  if (name !== 'index') {
    const newFolder = path.resolve(root, dir, name);
    const newFile = path.resolve(newFolder, `index${ext}`);
    console.log(`Move ${file} to ${newFile}`);
    await mkdir(newFolder);
    await mv(file, newFile);
  }
}

const run = R.pipeP(
  glob('/**/*.md'),
  R.map(printFileName),
  R.filter(filterNotMove(['index', 'README', 'SUMMARY'])),
  R.map(moveToIndex),
  catchError
);

run(process.argv[2]);