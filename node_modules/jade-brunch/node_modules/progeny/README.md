Progeny
=======
Recursively finds dependencies of style and template source files.

Or configure it to do the same kind of thing with any other type of text file.


Usage
-----
Call **Progeny** with an optional configuration object, it returns a reusable
function. There are built-in configurations already for `jade`, `stylus`,
`less`, and `sass`. Call that function with a path to a source file (and its
source code if you already have it handy), and it will figure out all of that
file's dependencies and sub-dependencies, passing an array of them to your
callback.

Examples using `path` assume you already have `var path = require('path');`.
You _could_ just use strings like `'/path/to/project'`, but you may run into
cross-compatibility issues.

##### Quick and Simple
You can skip the config object and the source code, letting **Progeny** read
the source from the file itself and apply a built-in configuration based on the file extension.

```javascript
var filePath = path.join('path', 'to', 'project', 'style-or-template.jade');
require('progeny')()(null, filePath, function (err, dependencies) {
    // use the dependencies array in here
});
```

##### Optional Configuration Attributes

```javascript
var progenyConfig = {
    // The file extension for the source code you want parsed
    // Will be derived from the source file path if not specified
    extension: 'styl',

    // Array of multiple file extensions to try when looking for dependencies
    extensionsList: ['scss', 'sass'],

    // Regexp to run on each line of source code to match dependency references
    // Make sure you wrap the file name part in (parentheses)
    regexp: /^\s*@import\s+['"]?([^'"]+)['"]?/,

    // File prefix to try (in addition to the raw value matched in the regexp)
    prefix: '_',

    // Matched stuff to exclude: string, regex, or array of either/both
    exclusion: /^compass/,

    // In case a match starts with a slash, the absolute path to apply
    rootPath: path.join('path', 'to', 'project')
};
```

##### More Examples
Process a list of files:

```javascript
var progeny = require('progeny');
var getDependencies = progeny(progenyConfig);
myFiles.forEach( function (file) {
    getDependencies(file.source, file.path, function (err, deps) {
        if (err) throw new Error(err);
        file.dependencies = deps;
    });
});
```

Multiple configs:

```javascript
var getDefaultDependencies = progeny();
var getCustomDependencies = progeny({
    extension: 'foo',
    regexp: /([^\s,]+)/
});
```

Process source code from a string without its file path:

```javascript
var mySourceString; // assume this contains valid source code
progeny({
    // extension and rootPath must be specified for this to work
    // also need regexp if extension not one of the predefined ones
    extension: 'jade',
    rootPath: path.join('path', 'to', 'project')
})(mySourceString, null, function (err, deps) {});
```


License
-------
[MIT](https://raw.github.com/es128/progeny/master/LICENSE)
