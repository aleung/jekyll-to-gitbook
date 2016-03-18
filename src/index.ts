import * as glob from 'glob';

glob('/**/*.md', { root: process.argv[2] }, (err, files) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  for (let file of files) {
    convertFile(file);
  }
});


function convertFile(file) {
  console.log(`Convert ${file}`);
}

