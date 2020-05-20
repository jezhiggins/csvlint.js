# CSV Lint

A Node package to support validating CSV files to check their syntax and contents. You can either use this package within your own JavaScript code, or as a standalone command line application.

## In Development

This package is in development. It is derived, with thanks, from [csvlint.rb](https://github.com/Data-Liberation-Front/csvlint.rb) developed by my friends at [The ODI](https://theodi.org/).

Initial work will port csvlint.rb to JavaScript, aiming for as full feature compatibility as is reasonable. There's may be some cosmetic changes, e.g. method and property names will be adapted from Ruby's snake_case to JavaScripts's more common camelCase, but the validation performed will be as similar as I can make it.

Future work will look to provide a [stream.Transform interface](https://nodejs.org/api/stream.html#stream_class_stream_transform) to csvlint.js so that it could be used, for example, as a validating parser in place of [csv-parse](https://www.npmjs.com/package/csv-parse).

*Note:* csvlint.js does not implement its own CSV parsing logic. That would be madness. Like all right-thinking JavaScript programmers, under the covers it uses [csv-parse](https://www.npmjs.com/package/csv-parse).  
