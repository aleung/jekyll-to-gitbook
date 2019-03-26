import * as R from 'ramda';
import * as _glob from 'glob';
import * as path from 'path';
import * as _mv from 'mv';
import * as fs from 'fs';
import * as fm from 'front-matter';

const projectPath = process.argv[2];

interface FrontMatterAttributes {
  title: string,
  author?: string,
  updated?: Date,
}

// TODO: Use node.js built-in promisify
// tslint:disable: ban-types no-unsafe-any
export function promisify<T>(f: Function): (...args: any[]) => Promise<T> {
  return (...args: any[]) =>
    new Promise<T>((resolve, reject) => f(...args, (err: any, data: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    }));
}

const log = R.curry(
  (msg?: string, data?: any) => {
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
  const { name } = path.parse(file);
  return R.contains(name, patterns);
});

async function moveToIndex(file: string): Promise<string> {
  const { root, dir, name, ext } = path.parse(file);
  const newFolder = path.resolve(root, dir, name === 'index' ? 'home' : name);
  const newFile = path.resolve(newFolder, `index${ext}`);
  console.log(`Move ${file}`);
  console.log(`... to ${newFile}`);
  await mv(file, newFile, { mkdirp: true });
  return newFile;
}

interface MarkdownPage extends FrontMatterAttributes {
  title: string;
  file: string;
  path: string;
  content: string;
}

type MarkdownConvertor = (page: MarkdownPage) => MarkdownPage;

// (string -> string) -> file -> string
const convert = R.curry((fn: MarkdownConvertor, file: string) => {
  const doc = fm<FrontMatterAttributes>(fs.readFileSync(file, 'utf8'));
  const converted = fn({
    file,
    title: doc.attributes.title,
    author: doc.attributes.author,
    updated: doc.attributes.updated,
    path: path.relative(projectPath, file),
    content: doc.body
  });
  // keep front matter:
  // fs.writeFileSync(file, `---\n${doc.frontmatter}\n---\n\n${converted.content}`);
  fs.writeFileSync(file, converted.content);
});

function removeToc(content: string): string {
  return content.replace(/{:\s*toc\s*}/g, '').replace(/^\* toc$/m, '');
}

function decreaseHeaderLevel(content: string): string {
  return content.replace(/^(#+)/mg, '#$1');
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

function convertSwagger(content: string): string {
  return content.replace(/{%\s*swagger\s+([^\s]+)\s*%}/g, '[OpenAPI spec file]($1)');
}

function addTitleAuthor(page: MarkdownPage): MarkdownPage {
  const authorLine = page.author ? `By: ${page.author}\n\n` : '';
  const dateLine = page.updated ? `Updated: ${page.updated.getUTCFullYear()}-${page.updated.getMonth()+1}-${page.updated.getDate()}\n\n` : '';
  return R.merge(page, { content: `# ${page.title}\n\n${authorLine}${dateLine}${page.content}` });
}

const addToSummary = R.curry(
  (summary: fs.WriteStream, page: MarkdownPage) => {
    summary.write(`* [${page.title}](${page.path})\n`);
    return page;
  }
);

const summaryFile = fs.createWriteStream(path.resolve(projectPath, 'SUMMARY.md'));

type ContentConverter = (c: string) => string;

const convertContentWith = R.curry(
  (fn: ContentConverter, page: MarkdownPage) => R.merge(page, { content: fn(page.content) })
);

// string -> string
const convertionPineline = R.pipe(
  addToSummary(summaryFile),
  convertContentWith(decreaseHeaderLevel),
  convertContentWith(convertImgTag),
  convertContentWith(convertPlantUmlTag),
  convertContentWith(removeToc),
  convertContentWith(convertGist),
  convertContentWith(convertSwagger),
  addTitleAuthor,
);

// file -> void
// @ts-ignore waiting for @types/ramda update
const processMarkdown = R.pipeWith(R.then)([
  (file: string) => inName(['README', 'SUMMARY'], file)
    ? Promise.resolve(file) : moveToIndex(file),
  log('Convert'),
  convert(convertionPineline)
]);

// dir -> void
// @ts-ignore waiting for @types/ramda update
const run = R.pipeWith(R.then)([
  glob('/@(dev|design|help|project|posts)/**/*.md'),
  R.map(processMarkdown)
]);

run(projectPath).then(log, log);

