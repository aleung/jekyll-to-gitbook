import * as R from 'ramda'
import * as _glob from 'glob';
import * as path from 'path';
import * as _mv from 'mv';
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

const log = R.curry(
  (msg, data) => {
    if (msg) {
      console.log(msg, data);
    } else {
      console.log(data);
    }
    return data;
  }
);


const glob = R.curry(
  (pattern: string, path: string) =>
    promisify<string[]>(_glob)(pattern, { root: path })
);


const mv = promisify<void>(_mv);

const inName = R.curry((patterns: string[], file: string) => {
  const {name} = path.parse(file);
  return R.contains(name, patterns);
});


async function moveToIndex(file: string): Promise<string> {
  const {root, dir, name, ext} = path.parse(file);
  const newFolder = path.resolve(root, dir, name === 'index' ? 'home' : name);
  const newFile = path.resolve(newFolder, `index${ext}`);
  console.log(`Move ${file}`);
  console.log(`... to ${newFile}`);
  await mv(file, newFile, { mkdirp: true });
  return newFile;
}


// (string -> string) -> file -> string
const convert = R.curry((fn, file) => {
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
});

function convertMarkdown(content: string): string {
  content = content.replace(/{%\s*img\s+([^\s]*)\s*%}/g, '![]($1)');
  content = content.replace(/{%\s*plantuml\s*%}/g, '{% plantuml format="png" %}');
  content = content.replace(/{:\s*toc\s*}/g, '<!-- toc -->');
  // TODO
  return content;
}


// file -> void
const processMarkdown = R.pipeP(
  (file) => inName(['README', 'SUMMARY'], file) ? Promise.resolve(file) : moveToIndex(file),
  log('Convert'),
  convert(convertMarkdown)
);


// dir -> void
const run = R.pipeP(
  glob('/**/*.md'),
  R.map(processMarkdown)
);


run(process.argv[2]).then(log(), log());