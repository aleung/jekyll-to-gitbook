# Jekyll site to GitBook converter

_This converter is specific for my own Jekyll site structure.
Clone and modify it to fit your need._

## Usage

1. Initial a gitbook project
1. Copy contents from Jekyll site to gitbook project, preserve folder structure.
   Contents are markdown files, images etc. Other files in Jekyll site, e.g.
   theme, templates, plugins, configuration should be excluded.
1. Run converter:
    yarn install
    node build/index.js /path/to/gitbook/project

Hint:

- To revert changes, use command: `git checkout -- . && git clean -df`
