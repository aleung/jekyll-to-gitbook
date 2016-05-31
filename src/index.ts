import * as R from 'ramda'
import * as _glob from 'glob';
import * as path from 'path';
import * as _mv from 'mv';
import * as fs from 'fs';
import * as fm from 'front-matter';

const projectPath = process.argv[2];

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

interface MarkdownPage {
  title: string;
  file: string;
  path: string;
  content: string;
}

type MarkdownConvertor = (page: MarkdownPage) => MarkdownPage;

// (string -> string) -> file -> string
const convert = R.curry((fn: MarkdownConvertor, file) => {
  const doc = fm(fs.readFileSync(file, 'utf8'));
  const converted = fn({
    file,
    title: doc.attributes.title,
    path: path.relative(projectPath, file),
    content: doc.body
  });
  fs.writeFileSync(file, `---\n${doc.yaml}\n---\n\n${converted.content}`);
});

function convertToc(content: string): string {
  return content.replace(/{:\s*toc\s*}/g, '<!-- toc -->');
}

function convertImgTag(content: string): string {
  return content.replace(/{%\s*img\s+([^\s]+\s+)?([^\s]+)(\s+[^\s]+)?\s*%}/g, '![]($2)');
}

function convertPlantUmlTag(content: string): string {
  return content.replace(/{%\s*plantuml\s*%}/g, '{% plantuml format="png" %}');
}

function convertGist(content: string): string {
  return content.replace(/{%\s*gist\s([^\s]+)\s*([^\s]+)?\s*%}/g, (match, p1, p2) => {
    return p2 ? `{% gist id="${p1}",file="${p2}" %}{% endgist %}` : `{% gist id="${p1}" %}{% endgist %}`;
  });
}

function addTitle(page: MarkdownPage): MarkdownPage {
  return R.merge(page, { content: `# ${page.title}\n\n${page.content}` });
}

const addToSummary = R.curry(
  (summary: fs.WriteStream, page: MarkdownPage) => {
    summary.write(`* [${page.title}](${page.path})\n`);
    return page;
  }
);

const summaryFile = fs.createWriteStream(path.resolve(projectPath, 'SUMMARY.md'));

const convertContentWith = R.curry(
  (fn, page: MarkdownPage) => R.merge(page, { content: fn(page.content) })
);


// string -> string
const convertionPineline = R.pipe(
  addToSummary(summaryFile),
  convertContentWith(convertImgTag),
  convertContentWith(convertPlantUmlTag),
  convertContentWith(convertToc),
  convertContentWith(convertGist),
  addTitle
);

// file -> void
const processMarkdown = R.pipeP(
  (file) => inName(['README', 'SUMMARY'], file) ? Promise.resolve(file) : moveToIndex(file),
  log('Convert'),
  convert(convertionPineline)
);


// dir -> void
const run = R.pipeP(
  glob('/@(dev|design|help|project|posts)/**/*.md'),
  R.map(processMarkdown)
);


run(projectPath).then(log(), log());

