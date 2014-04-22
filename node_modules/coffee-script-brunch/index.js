var coffeescript = require('coffee-script');

var isLiterate = function(path) {
  return /\.(litcoffee|coffee\.md)$/.test(path);
};

var normalizeChecker = function(item) {
  switch (toString.call(item)) {
    case '[object RegExp]':
      return function(string) {
        return item.test(string);
      };
    case '[object Function]':
      return item;
    default:
      return function() {
        return false;
      };
  }
};

function CoffeeScriptCompiler(config) {
  if (config == null) config = {};
  var plugin = config.plugins && config.plugins.coffeescript;
  var conv = config.conventions && config.conventions.vendor;
  this.bare = plugin && plugin.bare;
  this.sourceMaps = !!config.sourceMaps;
  this.isVendor = normalizeChecker(conv);
}

CoffeeScriptCompiler.prototype.brunchPlugin = true;
CoffeeScriptCompiler.prototype.type = 'javascript';
CoffeeScriptCompiler.prototype.extension = 'coffee';
CoffeeScriptCompiler.prototype.pattern = /\.(coffee(\.md)?|litcoffee)$/;

CoffeeScriptCompiler.prototype.compile = function(data, path, callback) {
  var options = {
    bare: this.bare == null ? !this.isVendor(path) : this.bare,
    sourceMap: this.sourceMaps,
    sourceFiles: [path],
    literate: isLiterate(path)
  };
  var compiled;
  try {
    compiled = coffeescript.compile(data, options);
  } catch (err) {
    var loc = err.location, error;
    if (loc) {
      error = loc.first_line + ":" + loc.first_column + " " + (err.toString());
    } else {
      error = err.toString();
    }
    return callback(error);
  }
  var result = (options.sourceMap && typeof compiled === 'object') ? {
    data: compiled.js,
    map: compiled.v3SourceMap
  } : {
    data: compiled
  };
  return callback(null, result);
};

module.exports = CoffeeScriptCompiler;
