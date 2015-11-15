(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false Mustache: true*/

(function defineMustache (global, factory) {
  if (typeof exports === 'object' && exports && typeof exports.nodeName !== 'string') {
    factory(exports); // CommonJS
  } else if (typeof define === 'function' && define.amd) {
    define(['exports'], factory); // AMD
  } else {
    global.Mustache = {};
    factory(Mustache); // script, wsh, asp
  }
}(this, function mustacheFactory (mustache) {

  var objectToString = Object.prototype.toString;
  var isArray = Array.isArray || function isArrayPolyfill (object) {
    return objectToString.call(object) === '[object Array]';
  };

  function isFunction (object) {
    return typeof object === 'function';
  }

  /**
   * More correct typeof string handling array
   * which normally returns typeof 'object'
   */
  function typeStr (obj) {
    return isArray(obj) ? 'array' : typeof obj;
  }

  function escapeRegExp (string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
  }

  /**
   * Null safe way of checking whether or not an object,
   * including its prototype, has a given property
   */
  function hasProperty (obj, propName) {
    return obj != null && typeof obj === 'object' && (propName in obj);
  }

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  var regExpTest = RegExp.prototype.test;
  function testRegExp (re, string) {
    return regExpTest.call(re, string);
  }

  var nonSpaceRe = /\S/;
  function isWhitespace (string) {
    return !testRegExp(nonSpaceRe, string);
  }

  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };

  function escapeHtml (string) {
    return String(string).replace(/[&<>"'\/]/g, function fromEntityMap (s) {
      return entityMap[s];
    });
  }

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var equalsRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  /**
   * Breaks up the given `template` string into a tree of tokens. If the `tags`
   * argument is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
   * course, the default is to use mustaches (i.e. mustache.tags).
   *
   * A token is an array with at least 4 elements. The first element is the
   * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
   * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
   * all text that appears outside a symbol this element is "text".
   *
   * The second element of a token is its "value". For mustache tags this is
   * whatever else was inside the tag besides the opening symbol. For text tokens
   * this is the text itself.
   *
   * The third and fourth elements of the token are the start and end indices,
   * respectively, of the token in the original template.
   *
   * Tokens that are the root node of a subtree contain two more elements: 1) an
   * array of tokens in the subtree and 2) the index in the original template at
   * which the closing tag for that section begins.
   */
  function parseTemplate (template, tags) {
    if (!template)
      return [];

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace () {
      if (hasTag && !nonSpace) {
        while (spaces.length)
          delete tokens[spaces.pop()];
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags (tagsToCompile) {
      if (typeof tagsToCompile === 'string')
        tagsToCompile = tagsToCompile.split(spaceRe, 2);

      if (!isArray(tagsToCompile) || tagsToCompile.length !== 2)
        throw new Error('Invalid tags: ' + tagsToCompile);

      openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + '\\s*');
      closingTagRe = new RegExp('\\s*' + escapeRegExp(tagsToCompile[1]));
      closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tagsToCompile[1]));
    }

    compileTags(tags || mustache.tags);

    var scanner = new Scanner(template);

    var start, type, value, chr, token, openSection;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(openingTagRe);

      if (value) {
        for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push([ 'text', chr, start, start + 1 ]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr === '\n')
            stripSpace();
        }
      }

      // Match the opening tag.
      if (!scanner.scan(openingTagRe))
        break;

      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(equalsRe);
        scanner.scan(equalsRe);
        scanner.scanUntil(closingTagRe);
      } else if (type === '{') {
        value = scanner.scanUntil(closingCurlyRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(closingTagRe);
        type = '&';
      } else {
        value = scanner.scanUntil(closingTagRe);
      }

      // Match the closing tag.
      if (!scanner.scan(closingTagRe))
        throw new Error('Unclosed tag at ' + scanner.pos);

      token = [ type, value, start, scanner.pos ];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        openSection = sections.pop();

        if (!openSection)
          throw new Error('Unopened section "' + value + '" at ' + start);

        if (openSection[1] !== value)
          throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        compileTags(value);
      }
    }

    // Make sure there are no open sections when we're done.
    openSection = sections.pop();

    if (openSection)
      throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    return nestTokens(squashTokens(tokens));
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens (tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          squashedTokens.push(token);
          lastToken = token;
        }
      }
    }

    return squashedTokens;
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens (tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];

    var token, section;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
      case '#':
      case '^':
        collector.push(token);
        sections.push(token);
        collector = token[4] = [];
        break;
      case '/':
        section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
        break;
      default:
        collector.push(token);
      }
    }

    return nestedTokens;
  }

  /**
   * A simple string scanner that is used by the template parser to find
   * tokens in template strings.
   */
  function Scanner (string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function eos () {
    return this.tail === '';
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function scan (re) {
    var match = this.tail.match(re);

    if (!match || match.index !== 0)
      return '';

    var string = match[0];

    this.tail = this.tail.substring(string.length);
    this.pos += string.length;

    return string;
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function scanUntil (re) {
    var index = this.tail.search(re), match;

    switch (index) {
    case -1:
      match = this.tail;
      this.tail = '';
      break;
    case 0:
      match = '';
      break;
    default:
      match = this.tail.substring(0, index);
      this.tail = this.tail.substring(index);
    }

    this.pos += match.length;

    return match;
  };

  /**
   * Represents a rendering context by wrapping a view object and
   * maintaining a reference to the parent context.
   */
  function Context (view, parentContext) {
    this.view = view;
    this.cache = { '.': this.view };
    this.parent = parentContext;
  }

  /**
   * Creates a new context using the given view with this context
   * as the parent.
   */
  Context.prototype.push = function push (view) {
    return new Context(view, this);
  };

  /**
   * Returns the value of the given name in this context, traversing
   * up the context hierarchy if the value is absent in this context's view.
   */
  Context.prototype.lookup = function lookup (name) {
    var cache = this.cache;

    var value;
    if (cache.hasOwnProperty(name)) {
      value = cache[name];
    } else {
      var context = this, names, index, lookupHit = false;

      while (context) {
        if (name.indexOf('.') > 0) {
          value = context.view;
          names = name.split('.');
          index = 0;

          /**
           * Using the dot notion path in `name`, we descend through the
           * nested objects.
           *
           * To be certain that the lookup has been successful, we have to
           * check if the last object in the path actually has the property
           * we are looking for. We store the result in `lookupHit`.
           *
           * This is specially necessary for when the value has been set to
           * `undefined` and we want to avoid looking up parent contexts.
           **/
          while (value != null && index < names.length) {
            if (index === names.length - 1)
              lookupHit = hasProperty(value, names[index]);

            value = value[names[index++]];
          }
        } else {
          value = context.view[name];
          lookupHit = hasProperty(context.view, name);
        }

        if (lookupHit)
          break;

        context = context.parent;
      }

      cache[name] = value;
    }

    if (isFunction(value))
      value = value.call(this.view);

    return value;
  };

  /**
   * A Writer knows how to take a stream of tokens and render them to a
   * string, given a context. It also maintains a cache of templates to
   * avoid the need to parse the same template twice.
   */
  function Writer () {
    this.cache = {};
  }

  /**
   * Clears all cached templates in this writer.
   */
  Writer.prototype.clearCache = function clearCache () {
    this.cache = {};
  };

  /**
   * Parses and caches the given `template` and returns the array of tokens
   * that is generated from the parse.
   */
  Writer.prototype.parse = function parse (template, tags) {
    var cache = this.cache;
    var tokens = cache[template];

    if (tokens == null)
      tokens = cache[template] = parseTemplate(template, tags);

    return tokens;
  };

  /**
   * High-level method that is used to render the given `template` with
   * the given `view`.
   *
   * The optional `partials` argument may be an object that contains the
   * names and templates of partials that are used in the template. It may
   * also be a function that is used to load partial templates on the fly
   * that takes a single argument: the name of the partial.
   */
  Writer.prototype.render = function render (template, view, partials) {
    var tokens = this.parse(template);
    var context = (view instanceof Context) ? view : new Context(view);
    return this.renderTokens(tokens, context, partials, template);
  };

  /**
   * Low-level method that renders the given array of `tokens` using
   * the given `context` and `partials`.
   *
   * Note: The `originalTemplate` is only ever used to extract the portion
   * of the original template that was contained in a higher-order section.
   * If the template doesn't use higher-order sections, this argument may
   * be omitted.
   */
  Writer.prototype.renderTokens = function renderTokens (tokens, context, partials, originalTemplate) {
    var buffer = '';

    var token, symbol, value;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      value = undefined;
      token = tokens[i];
      symbol = token[0];

      if (symbol === '#') value = this.renderSection(token, context, partials, originalTemplate);
      else if (symbol === '^') value = this.renderInverted(token, context, partials, originalTemplate);
      else if (symbol === '>') value = this.renderPartial(token, context, partials, originalTemplate);
      else if (symbol === '&') value = this.unescapedValue(token, context);
      else if (symbol === 'name') value = this.escapedValue(token, context);
      else if (symbol === 'text') value = this.rawValue(token);

      if (value !== undefined)
        buffer += value;
    }

    return buffer;
  };

  Writer.prototype.renderSection = function renderSection (token, context, partials, originalTemplate) {
    var self = this;
    var buffer = '';
    var value = context.lookup(token[1]);

    // This function is used to render an arbitrary template
    // in the current context by higher-order sections.
    function subRender (template) {
      return self.render(template, context, partials);
    }

    if (!value) return;

    if (isArray(value)) {
      for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
        buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate);
      }
    } else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
      buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
    } else if (isFunction(value)) {
      if (typeof originalTemplate !== 'string')
        throw new Error('Cannot use higher-order sections without the original template');

      // Extract the portion of the original template that the section contains.
      value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

      if (value != null)
        buffer += value;
    } else {
      buffer += this.renderTokens(token[4], context, partials, originalTemplate);
    }
    return buffer;
  };

  Writer.prototype.renderInverted = function renderInverted (token, context, partials, originalTemplate) {
    var value = context.lookup(token[1]);

    // Use JavaScript's definition of falsy. Include empty arrays.
    // See https://github.com/janl/mustache.js/issues/186
    if (!value || (isArray(value) && value.length === 0))
      return this.renderTokens(token[4], context, partials, originalTemplate);
  };

  Writer.prototype.renderPartial = function renderPartial (token, context, partials) {
    if (!partials) return;

    var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
    if (value != null)
      return this.renderTokens(this.parse(value), context, partials, value);
  };

  Writer.prototype.unescapedValue = function unescapedValue (token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return value;
  };

  Writer.prototype.escapedValue = function escapedValue (token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return mustache.escape(value);
  };

  Writer.prototype.rawValue = function rawValue (token) {
    return token[1];
  };

  mustache.name = 'mustache.js';
  mustache.version = '2.1.3';
  mustache.tags = [ '{{', '}}' ];

  // All high-level mustache.* functions use this writer.
  var defaultWriter = new Writer();

  /**
   * Clears all cached templates in the default writer.
   */
  mustache.clearCache = function clearCache () {
    return defaultWriter.clearCache();
  };

  /**
   * Parses and caches the given template in the default writer and returns the
   * array of tokens it contains. Doing this ahead of time avoids the need to
   * parse templates on the fly as they are rendered.
   */
  mustache.parse = function parse (template, tags) {
    return defaultWriter.parse(template, tags);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  mustache.render = function render (template, view, partials) {
    if (typeof template !== 'string') {
      throw new TypeError('Invalid template! Template should be a "string" ' +
                          'but "' + typeStr(template) + '" was given as the first ' +
                          'argument for mustache#render(template, view, partials)');
    }

    return defaultWriter.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.,
  /*eslint-disable */ // eslint wants camel cased function name
  mustache.to_html = function to_html (template, view, partials, send) {
    /*eslint-enable*/

    var result = mustache.render(template, view, partials);

    if (isFunction(send)) {
      send(result);
    } else {
      return result;
    }
  };

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  mustache.escape = escapeHtml;

  // Export these mainly for testing, but also for advanced usage.
  mustache.Scanner = Scanner;
  mustache.Context = Context;
  mustache.Writer = Writer;

}));

},{}],2:[function(require,module,exports){
// CLI - View
var CLI = require("./cli.js");
var data = require("./data.js");
var template = require("../template/ls.js");

var mu = require("mustache");

// mu.root = "../template"

var cli = new CLI(data, "root", "khaled");


function Display(screen) {
    var UP_KEY = 38,
        DOWN_KEY = 40,
        ENTER_KEY = 13,
        META_KEY = 91,
        //letter k in the keyboard
        K_KEY = 75;

    // To track location in lastCommand [] by up/down arrow 
    this.where = cli.lastCommand.length;

    // Main Element  
    this.terminal = document.createElement("div");
    this.result = document.createElement("div");
    this.inputDiv = document.createElement("div");
    this.inputEm = document.createElement("em");
    this.input = document.createElement("input");
    
    // When user enter something 
    this.inputEm.innerHTML = cli.workingDirectory + " $";
    this.inputDiv.className = "inputDiv";
    this.terminal.className = "terminal";
    this.terminal.setAttribute("tabindex", 1)

    var self = this;
   
    // Listen to keystrokes inside terminal screen + (Help focus to the input)
    this.terminal.onkeydown = function(e) {
        switch (e.which) {
            case ENTER_KEY:
                e.preventDefault();
                break;
        }

        self.input.focus();
    }

    //capture key strokes inside input
    this.input.onkeyup = function(e) {
        switch (e.which) {
            case ENTER_KEY:
                self.enter(e);
                break;
            case UP_KEY:
                self.upkey(e);
                break;
            case DOWN_KEY:
                self.downkey(e);
                break;
            case (e.ctrlKey && K_KEY):
                console.log("presses")
                self.clear();
                break;
            case e.metaKey:
                console.log("METAKEY");
                break;
            default:
                break;
        }
        // console.log("e", e.metaKey, e.ctrlKey , e.which);
        console.log("e", e);
        // Automatically scroll to the bottom 
        // window.scrollTo(0, document.body.offsetHeight);
        self.terminal.scrollTop = self.terminal.scrollHeight;
    }

    //Append to the terminal 
    this.terminal.appendChild(this.result);
    this.inputDiv.appendChild(this.inputEm);
    this.inputDiv.appendChild(this.input);
    this.terminal.appendChild(this.inputDiv)
    screen.appendChild(this.terminal)

}



// Prototype Chain
Display.prototype.clear = function() {
    this.result.innerHTML = "";
    this.input.value = "";
    return;
}

Display.prototype.enter = function(e) {
    //GUI Affect Commands 
    if (this.input.value == "clear") {
        return this.clear();
    }

    var view = this.getView(this.input.value);

    this.result.insertAdjacentHTML("beforeend", view)

    //reset
    this.inputEm.innerHTML = cli.workingDirectory + " $";
    this.input.value = '';
    this.where = cli.lastCommand.length;
}

Display.prototype.upkey = function() {
    var letWhere = this.where - 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        this.input.value = cli.lastCommand[--this.where];
        //start from the end 
        var len = this.input.value.length;
        this.input.setSelectionRange(len, len);
        return;
    }
}

Display.prototype.downkey = function() {
    var letWhere = this.where + 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        this.input.value = cli.lastCommand[++this.where];
        return;
    }

    // reached the limit reset 
    this.where = cli.lastCommand.length;
    this.input.value = '';
}

Display.prototype.getView = function(command) {
    try {
        return this.getViewHelper(cli.run(command))
    } catch (e) {
        return this.getViewHelper(e.message);
    }
}

Display.prototype.getViewHelper = function(result) {
    var obj = {
        workingDirectory: cli.workingDirectory,
        command: cli.lastCommand[cli.lastCommand.length - 1],
        result: result
    }

    if (this.isObject(result)) {
        obj.isCompany = obj.result.company ? true : false;
        return mu.to_html(template.section, obj);
    }

    if (Array.isArray(result)) {
        obj.result = obj.result.join("&nbsp;&nbsp;");
        return mu.to_html(template.list, obj);
    }

    return mu.to_html(template.list, obj);
};

Display.prototype.isObject = function(obj) {
    return typeof obj === "object" && !Array.isArray(obj) && obj !== null;
};

},{"../template/ls.js":6,"./cli.js":4,"./data.js":5,"mustache":1}],3:[function(require,module,exports){
//CLI - Model 

function Storage(data) {
    this.directory = data || {};
}


Storage.prototype.dir = function(pwd, directory) {
    var currDir = this.directory;
    var directory = directory || false; 
    //if directory is not given 
    var subDir = pwd.split('/');
    subDir.shift(); //removes this.root 
    if (pwd == '' || pwd == undefined || pwd == null) {
        return currDir;
    }


    for (var i = 0; i < subDir.length; i++) {
        if (!this.has(currDir, subDir[i])) {
            throw new Error("cd: The directory '" + subDir[i] + "' does not exist");
        }
        if (directory) {
            if (!this.isDirectory(currDir[subDir[i]])) {
                throw new Error("cd: '" + subDir[i]  +"' is not a directory")
            }
        }

        currDir = currDir[subDir[i]]
    }
    return currDir;
};


Storage.prototype.list = function(pwd) {
    var list = [];
    var dir = this.dir(pwd);

    for (var i in dir) {
        if (dir.hasOwnProperty(i)) {
            if (i != "directory")
                list.push(i)
        }
    }
    return list;
};

Storage.prototype.isDirectory = function(obj) {
    if (obj.hasOwnProperty("directory")) {
        if (obj["directory"] == false)
            return false;
    }

    return true;
};

Storage.prototype.has = function(dir, subDir) {
    if (dir.hasOwnProperty(subDir)) {
        return true
    }

    return false;
};

module.exports = Storage;

},{}],4:[function(require,module,exports){
// CLI - Controller
var Storage = require("./Storage.js");

// CLI - Simple the runner Controller 
function CLI(data, root, owner) {
    //user info 
    this.owner = owner;
    this.root  = root || "root";
    //pwd 
    this.workingDirectory = owner || this.root ;
    //commands storage
    this.lastCommand = [];
    this.commands = ["ls", "help", "?", "cd", "cat", "pwd", "open"];
    //the data object 
    this.data = new Storage(data);
}

//CLI - Begin Prototype 
CLI.prototype.setPwd = function(pwd) {
    this.workingDirectory = this.cleanPwd(pwd);
}

CLI.prototype.cleanPwd = function(pwd) {
    var listDirectory = pwd.split(/[\s|\/]/); // . | space | slash  
    for (var i = listDirectory.length - 1; i >= 0; i--) {
        if (listDirectory[i].length === 0) {
            listDirectory.splice(i, 1)
        }
    };
    //clean pwd from spaces/slashes at the end of the link(pwd)
    return listDirectory.join('/');
},
CLI.prototype.run = function (input) {
    var arg = input.split(/\s+/); //removing unnecessary spaces 
    var command = arg[0].toLowerCase(); //
    var pwd = arg[1] ? this.cleanPwd(arg[1]) : this.workingDirectory;

    this.lastCommand.push(input); 

    if (this.commands.indexOf(command) == -1) {
        throw Error("Unknown command '" + command + "'");
    }
    return this.option(command, pwd)
},
CLI.prototype.option = function(command, pwd) {
    switch (command) {
        case 'ls':
            return this.ls(pwd);
        case '?':
        case 'help':
            return this.help(pwd);
        case 'cd':
            return this.cd(pwd);
        case 'cat':
            return this.cat(pwd);
        case 'open':
            return this.open(pwd);
        case 'pwd':
            return this.pwd(pwd)
    }

}
CLI.prototype.ls = function(pwd) {
    if(pwd !== this.workingDirectory)
        pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);

    file = this.data.dir(pwd);

    if (!this.data.isDirectory(file)) {
        return pwd.split('/')[1];
    }

    return this.data.list(pwd);
}
CLI.prototype.help = function(pwd) {
    return ("   <pre> Welcome to "+this.owner+"'s server via the terminal\n"+
            "   ?, help : shows some helpful commands.\n" +
            "        cd : change directory.\n" +
            "        ls : list directory contents \n" +
            "       pwd : output the current working directory\n" +
            "       cat : print the file 😉.\n" +
            "        vi : coming out soon\n" +
            "     clear : clears the console. try \'ctrl+k\'"+
            "   </pre>")
    // return "&nbsp;&nbsp;cd:  </br> &nbsp;&nbsp;ls:  <br> &nbsp;&nbsp; </br> &nbsp;&nbsp;cat: read a file </br> &nbsp;&nbsp;";
}
CLI.prototype.open = function(pwd) {
    var pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);
    var dir = this.data.dir(pwd);
    if(this.data.isDirectory(dir)){
        throw Error("sorry there is no support to 'open' directories yet :(")
    }
    if(dir.url == undefined || dir.url == null){
        throw Error("no URL is specify to be open!")
    }
    window.open(dir.url)
    return dir.url;
}

CLI.prototype.cat = function(pwd) {
	var fullPwd = this.cleanPwd(this.workingDirectory + '/' + pwd);

    var file = this.data.dir(fullPwd); 
    if (this.data.isDirectory(file)) {
        throw new Error("cat: '" + pwd  +"' is a directory")
    }
    return file;
}

CLI.prototype.pwd = function() {
    return "/"+this.workingDirectory;
}
CLI.prototype.cd = function(pwd) {
    if (pwd == "..") {
        var arrayDirectory = this.workingDirectory.split('/');
        if(arrayDirectory.length > 1){
            arrayDirectory.pop();
        }
        pwd = arrayDirectory.join('/')
        this.workingDirectory = pwd;
    } else {
	    var pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);
        //check if the pwd is a directory 
        this.data.dir(pwd, true);

        this.workingDirectory = pwd; 
    }

    this.setPwd(this.workingDirectory);

    return '';
}

module.exports = CLI; 

},{"./Storage.js":3}],5:[function(require,module,exports){
//Experience 
var TFA = {
    "header": "Teach For America",
    "subHeader": "Front-End Developer",
    "detail": ["Lot of JavaSript, HTML, & CSS"],
    "location": "NYC, New York",
    "period": "August-December `14",
    "url": "https://www.teachforamerica.org/",
    "directory": false
}

var ABC = {
    "header": "ABC Global System",
    "subHeader": "Software Developer",
    "detail": ["📉 Create software to manipulate and extract data using Regex Expression with Java on UNIX system ",
        "💻 Developed web applications using HTML/XHTML, CSS and JavaScript with PHP &amp; MySQL ",
        "📰 Create and manage CMS using WordPress to ensure security and efficiency for the End-Users"
    ],
    "period": "January-August '14",
    "location": "NYC, New York",
    "url": "www.abcglobalsystems.com/",
    "directory": false
}

//BinaryHeap
var BinaryHeap = {
    "header": "BinaryHeap",
    "subHeader": "Open-Source",
    "detail": "BinaryHeap Implementation as BinaryTree-like structure",
    "location": "Aden, Yemen",
    "period": "September",
    "url": "https://github.com/KhaledMohamedP/BinaryHeap",
    "directory": false,
}

var HuffmandCoding = {
    "header": "HuffmanCoding",
    "subHeader": "Open-Source",
    "detail": "HuffmandCoding using JS, HTML, CSS COOL huh",
    "location": "Aden, Yemen",
    "period": "June",
    "url": "https://khaledm.com/huffman",
    "directory": false
}

//skills
var skills = {
    "header": "Skills",
    "subHeader": "🔧 Tools I've used",
    "period": "2006-" + new Date().getFullYear().toString(),
    "detail": [
        "✓ Languages: JavaScript,  C++, Java , & Others",
        "✓ JS Framework: JQuery, AngularJS, Backbone.js, & D3JS",
        "✓ Open-Source: WordPress, vBulltin, & XenForo "
    ],
    "url": "https://github.com/KhaledMohamedP",
    "directory": false
};

var certification = {
    "header": "Certification",
    "subHeader": "List of certification (IT)",
    "detail": [
        "✓ CompTIA A+ , CompTIA License MHGCHPBRLF1QQPF",
        "✓ Microsoft Certified Professional, Microsoft License E785­5479",
        "✓ Server Virtualization with Windows Server Hyper­V and System Center, Microsoft"
    ],
    "directory": false
}

//education 
var education = {
        "header": "Brooklyn College",
        "subHeader": "🎓 Computer Science",
        "period": "2010-2014",
        "detail": [
            "Dean list '13 '14",
            "CS Mentor with the Department of Computer Science",
        ],
        "directory": false
    }
    //File structure
var directory = {
    "experience": {
        "TFA": TFA,
        "ABC": ABC,
    },
    "projects": {
        "BinaryHeap": BinaryHeap,
        "HuffmandCoding": HuffmandCoding,
    },
    "others": {
        "education": education,
        "skills": skills,
        "certification": certification
    }

}
module.exports = directory;

},{}],6:[function(require,module,exports){
var section = ["<div>",
					"<em>{{workingDirectory}} $ {{command}}</em>",
				"</div>",
				"<div class=\"section\">",
					"<div class=\"header\">",
						"<div class=\"title\">",
							"<b>{{result.header}}</b>",
							"</br>",
							"<em>~ {{result.subHeader}}</em>", 
						"</div>",
						"<b class=\"period\">  {{result.location}}  </br> {{result.period}}</b>",
					"</div>",
					"<div class=\"clearfix\"></div> ",
					"<hr> ",
					"<div class=\"details\"> ",
						"<ul>{{#result.detail}} <li>{{.}}</li>{{/result.detail}}</ul>",
					"</div>",
				"</div>"].join("\n");

var list = ["<div class=\"list\"> ",
	    		"<em>{{workingDirectory}} $ {{command}}</em>", 
	    		"<p>{{&result}}</p>",
    		"</div>"].join("\n");

module.exports = {
    section: section,
    list: list
}
},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXVzdGFjaGUvbXVzdGFjaGUuanMiLCJzcmMvanMvRGlzcGxheS5qcyIsInNyYy9qcy9TdG9yYWdlLmpzIiwic3JjL2pzL2NsaS5qcyIsInNyYy9qcy9kYXRhLmpzIiwic3JjL3RlbXBsYXRlL2xzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbm5CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIVxuICogbXVzdGFjaGUuanMgLSBMb2dpYy1sZXNzIHt7bXVzdGFjaGV9fSB0ZW1wbGF0ZXMgd2l0aCBKYXZhU2NyaXB0XG4gKiBodHRwOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzXG4gKi9cblxuLypnbG9iYWwgZGVmaW5lOiBmYWxzZSBNdXN0YWNoZTogdHJ1ZSovXG5cbihmdW5jdGlvbiBkZWZpbmVNdXN0YWNoZSAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgZXhwb3J0cyAmJiB0eXBlb2YgZXhwb3J0cy5ub2RlTmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICBmYWN0b3J5KGV4cG9ydHMpOyAvLyBDb21tb25KU1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbJ2V4cG9ydHMnXSwgZmFjdG9yeSk7IC8vIEFNRFxuICB9IGVsc2Uge1xuICAgIGdsb2JhbC5NdXN0YWNoZSA9IHt9O1xuICAgIGZhY3RvcnkoTXVzdGFjaGUpOyAvLyBzY3JpcHQsIHdzaCwgYXNwXG4gIH1cbn0odGhpcywgZnVuY3Rpb24gbXVzdGFjaGVGYWN0b3J5IChtdXN0YWNoZSkge1xuXG4gIHZhciBvYmplY3RUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiBpc0FycmF5UG9seWZpbGwgKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3RUb1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNGdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdmdW5jdGlvbic7XG4gIH1cblxuICAvKipcbiAgICogTW9yZSBjb3JyZWN0IHR5cGVvZiBzdHJpbmcgaGFuZGxpbmcgYXJyYXlcbiAgICogd2hpY2ggbm9ybWFsbHkgcmV0dXJucyB0eXBlb2YgJ29iamVjdCdcbiAgICovXG4gIGZ1bmN0aW9uIHR5cGVTdHIgKG9iaikge1xuICAgIHJldHVybiBpc0FycmF5KG9iaikgPyAnYXJyYXknIDogdHlwZW9mIG9iajtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCAoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bXFwtXFxbXFxde30oKSorPy4sXFxcXFxcXiR8I1xcc10vZywgJ1xcXFwkJicpO1xuICB9XG5cbiAgLyoqXG4gICAqIE51bGwgc2FmZSB3YXkgb2YgY2hlY2tpbmcgd2hldGhlciBvciBub3QgYW4gb2JqZWN0LFxuICAgKiBpbmNsdWRpbmcgaXRzIHByb3RvdHlwZSwgaGFzIGEgZ2l2ZW4gcHJvcGVydHlcbiAgICovXG4gIGZ1bmN0aW9uIGhhc1Byb3BlcnR5IChvYmosIHByb3BOYW1lKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIChwcm9wTmFtZSBpbiBvYmopO1xuICB9XG5cbiAgLy8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9DT1VDSERCLTU3N1xuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4OVxuICB2YXIgcmVnRXhwVGVzdCA9IFJlZ0V4cC5wcm90b3R5cGUudGVzdDtcbiAgZnVuY3Rpb24gdGVzdFJlZ0V4cCAocmUsIHN0cmluZykge1xuICAgIHJldHVybiByZWdFeHBUZXN0LmNhbGwocmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgbm9uU3BhY2VSZSA9IC9cXFMvO1xuICBmdW5jdGlvbiBpc1doaXRlc3BhY2UgKHN0cmluZykge1xuICAgIHJldHVybiAhdGVzdFJlZ0V4cChub25TcGFjZVJlLCBzdHJpbmcpO1xuICB9XG5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICAnJic6ICcmYW1wOycsXG4gICAgJzwnOiAnJmx0OycsXG4gICAgJz4nOiAnJmd0OycsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmIzM5OycsXG4gICAgJy8nOiAnJiN4MkY7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwgKHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInXFwvXS9nLCBmdW5jdGlvbiBmcm9tRW50aXR5TWFwIChzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgZXF1YWxzUmUgPSAvXFxzKj0vO1xuICB2YXIgY3VybHlSZSA9IC9cXHMqXFx9LztcbiAgdmFyIHRhZ1JlID0gLyN8XFxefFxcL3w+fFxce3wmfD18IS87XG5cbiAgLyoqXG4gICAqIEJyZWFrcyB1cCB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCBzdHJpbmcgaW50byBhIHRyZWUgb2YgdG9rZW5zLiBJZiB0aGUgYHRhZ3NgXG4gICAqIGFyZ3VtZW50IGlzIGdpdmVuIGhlcmUgaXQgbXVzdCBiZSBhbiBhcnJheSB3aXRoIHR3byBzdHJpbmcgdmFsdWVzOiB0aGVcbiAgICogb3BlbmluZyBhbmQgY2xvc2luZyB0YWdzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIChlLmcuIFsgXCI8JVwiLCBcIiU+XCIgXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBtdXN0YWNoZS50YWdzKS5cbiAgICpcbiAgICogQSB0b2tlbiBpcyBhbiBhcnJheSB3aXRoIGF0IGxlYXN0IDQgZWxlbWVudHMuIFRoZSBmaXJzdCBlbGVtZW50IGlzIHRoZVxuICAgKiBtdXN0YWNoZSBzeW1ib2wgdGhhdCB3YXMgdXNlZCBpbnNpZGUgdGhlIHRhZywgZS5nLiBcIiNcIiBvciBcIiZcIi4gSWYgdGhlIHRhZ1xuICAgKiBkaWQgbm90IGNvbnRhaW4gYSBzeW1ib2wgKGkuZS4ge3tteVZhbHVlfX0pIHRoaXMgZWxlbWVudCBpcyBcIm5hbWVcIi4gRm9yXG4gICAqIGFsbCB0ZXh0IHRoYXQgYXBwZWFycyBvdXRzaWRlIGEgc3ltYm9sIHRoaXMgZWxlbWVudCBpcyBcInRleHRcIi5cbiAgICpcbiAgICogVGhlIHNlY29uZCBlbGVtZW50IG9mIGEgdG9rZW4gaXMgaXRzIFwidmFsdWVcIi4gRm9yIG11c3RhY2hlIHRhZ3MgdGhpcyBpc1xuICAgKiB3aGF0ZXZlciBlbHNlIHdhcyBpbnNpZGUgdGhlIHRhZyBiZXNpZGVzIHRoZSBvcGVuaW5nIHN5bWJvbC4gRm9yIHRleHQgdG9rZW5zXG4gICAqIHRoaXMgaXMgdGhlIHRleHQgaXRzZWxmLlxuICAgKlxuICAgKiBUaGUgdGhpcmQgYW5kIGZvdXJ0aCBlbGVtZW50cyBvZiB0aGUgdG9rZW4gYXJlIHRoZSBzdGFydCBhbmQgZW5kIGluZGljZXMsXG4gICAqIHJlc3BlY3RpdmVseSwgb2YgdGhlIHRva2VuIGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVG9rZW5zIHRoYXQgYXJlIHRoZSByb290IG5vZGUgb2YgYSBzdWJ0cmVlIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGFuXG4gICAqIGFycmF5IG9mIHRva2VucyBpbiB0aGUgc3VidHJlZSBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSBhdFxuICAgKiB3aGljaCB0aGUgY2xvc2luZyB0YWcgZm9yIHRoYXQgc2VjdGlvbiBiZWdpbnMuXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlICh0ZW1wbGF0ZSwgdGFncykge1xuICAgIGlmICghdGVtcGxhdGUpXG4gICAgICByZXR1cm4gW107XG5cbiAgICB2YXIgc2VjdGlvbnMgPSBbXTsgICAgIC8vIFN0YWNrIHRvIGhvbGQgc2VjdGlvbiB0b2tlbnNcbiAgICB2YXIgdG9rZW5zID0gW107ICAgICAgIC8vIEJ1ZmZlciB0byBob2xkIHRoZSB0b2tlbnNcbiAgICB2YXIgc3BhY2VzID0gW107ICAgICAgIC8vIEluZGljZXMgb2Ygd2hpdGVzcGFjZSB0b2tlbnMgb24gdGhlIGN1cnJlbnQgbGluZVxuICAgIHZhciBoYXNUYWcgPSBmYWxzZTsgICAgLy8gSXMgdGhlcmUgYSB7e3RhZ319IG9uIHRoZSBjdXJyZW50IGxpbmU/XG4gICAgdmFyIG5vblNwYWNlID0gZmFsc2U7ICAvLyBJcyB0aGVyZSBhIG5vbi1zcGFjZSBjaGFyIG9uIHRoZSBjdXJyZW50IGxpbmU/XG5cbiAgICAvLyBTdHJpcHMgYWxsIHdoaXRlc3BhY2UgdG9rZW5zIGFycmF5IGZvciB0aGUgY3VycmVudCBsaW5lXG4gICAgLy8gaWYgdGhlcmUgd2FzIGEge3sjdGFnfX0gb24gaXQgYW5kIG90aGVyd2lzZSBvbmx5IHNwYWNlLlxuICAgIGZ1bmN0aW9uIHN0cmlwU3BhY2UgKCkge1xuICAgICAgaWYgKGhhc1RhZyAmJiAhbm9uU3BhY2UpIHtcbiAgICAgICAgd2hpbGUgKHNwYWNlcy5sZW5ndGgpXG4gICAgICAgICAgZGVsZXRlIHRva2Vuc1tzcGFjZXMucG9wKCldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BhY2VzID0gW107XG4gICAgICB9XG5cbiAgICAgIGhhc1RhZyA9IGZhbHNlO1xuICAgICAgbm9uU3BhY2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgb3BlbmluZ1RhZ1JlLCBjbG9zaW5nVGFnUmUsIGNsb3NpbmdDdXJseVJlO1xuICAgIGZ1bmN0aW9uIGNvbXBpbGVUYWdzICh0YWdzVG9Db21waWxlKSB7XG4gICAgICBpZiAodHlwZW9mIHRhZ3NUb0NvbXBpbGUgPT09ICdzdHJpbmcnKVxuICAgICAgICB0YWdzVG9Db21waWxlID0gdGFnc1RvQ29tcGlsZS5zcGxpdChzcGFjZVJlLCAyKTtcblxuICAgICAgaWYgKCFpc0FycmF5KHRhZ3NUb0NvbXBpbGUpIHx8IHRhZ3NUb0NvbXBpbGUubGVuZ3RoICE9PSAyKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdGFnczogJyArIHRhZ3NUb0NvbXBpbGUpO1xuXG4gICAgICBvcGVuaW5nVGFnUmUgPSBuZXcgUmVnRXhwKGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzBdKSArICdcXFxccyonKTtcbiAgICAgIGNsb3NpbmdUYWdSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAodGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgICAgY2xvc2luZ0N1cmx5UmUgPSBuZXcgUmVnRXhwKCdcXFxccyonICsgZXNjYXBlUmVnRXhwKCd9JyArIHRhZ3NUb0NvbXBpbGVbMV0pKTtcbiAgICB9XG5cbiAgICBjb21waWxlVGFncyh0YWdzIHx8IG11c3RhY2hlLnRhZ3MpO1xuXG4gICAgdmFyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0ZW1wbGF0ZSk7XG5cbiAgICB2YXIgc3RhcnQsIHR5cGUsIHZhbHVlLCBjaHIsIHRva2VuLCBvcGVuU2VjdGlvbjtcbiAgICB3aGlsZSAoIXNjYW5uZXIuZW9zKCkpIHtcbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIGFueSB0ZXh0IGJldHdlZW4gdGFncy5cbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwob3BlbmluZ1RhZ1JlKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCB2YWx1ZUxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IHZhbHVlTGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjaHIgPSB2YWx1ZS5jaGFyQXQoaSk7XG5cbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNocikpIHtcbiAgICAgICAgICAgIHNwYWNlcy5wdXNoKHRva2Vucy5sZW5ndGgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goWyAndGV4dCcsIGNociwgc3RhcnQsIHN0YXJ0ICsgMSBdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIHdoaXRlc3BhY2Ugb24gdGhlIGN1cnJlbnQgbGluZS5cbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxuJylcbiAgICAgICAgICAgIHN0cmlwU3BhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihvcGVuaW5nVGFnUmUpKVxuICAgICAgICBicmVhaztcblxuICAgICAgaGFzVGFnID0gdHJ1ZTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdHlwZS5cbiAgICAgIHR5cGUgPSBzY2FubmVyLnNjYW4odGFnUmUpIHx8ICduYW1lJztcbiAgICAgIHNjYW5uZXIuc2Nhbih3aGl0ZVJlKTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAneycpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nQ3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgICAgdHlwZSA9ICcmJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4oY2xvc2luZ1RhZ1JlKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCB0YWcgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgICAgdG9rZW4gPSBbIHR5cGUsIHZhbHVlLCBzdGFydCwgc2Nhbm5lci5wb3MgXTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgaWYgKHR5cGUgPT09ICcjJyB8fCB0eXBlID09PSAnXicpIHtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcvJykge1xuICAgICAgICAvLyBDaGVjayBzZWN0aW9uIG5lc3RpbmcuXG4gICAgICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICAgICAgaWYgKCFvcGVuU2VjdGlvbilcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vub3BlbmVkIHNlY3Rpb24gXCInICsgdmFsdWUgKyAnXCIgYXQgJyArIHN0YXJ0KTtcblxuICAgICAgICBpZiAob3BlblNlY3Rpb25bMV0gIT09IHZhbHVlKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBvcGVuU2VjdGlvblsxXSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnbmFtZScgfHwgdHlwZSA9PT0gJ3snIHx8IHR5cGUgPT09ICcmJykge1xuICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICc9Jykge1xuICAgICAgICAvLyBTZXQgdGhlIHRhZ3MgZm9yIHRoZSBuZXh0IHRpbWUgYXJvdW5kLlxuICAgICAgICBjb21waWxlVGFncyh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoZXJlIGFyZSBubyBvcGVuIHNlY3Rpb25zIHdoZW4gd2UncmUgZG9uZS5cbiAgICBvcGVuU2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuXG4gICAgaWYgKG9wZW5TZWN0aW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzY2FubmVyLnBvcyk7XG5cbiAgICByZXR1cm4gbmVzdFRva2VucyhzcXVhc2hUb2tlbnModG9rZW5zKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgdGhlIHZhbHVlcyBvZiBjb25zZWN1dGl2ZSB0ZXh0IHRva2VucyBpbiB0aGUgZ2l2ZW4gYHRva2Vuc2AgYXJyYXlcbiAgICogdG8gYSBzaW5nbGUgdG9rZW4uXG4gICAqL1xuICBmdW5jdGlvbiBzcXVhc2hUb2tlbnMgKHRva2Vucykge1xuICAgIHZhciBzcXVhc2hlZFRva2VucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuLCBsYXN0VG9rZW47XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIGlmICh0b2tlbikge1xuICAgICAgICBpZiAodG9rZW5bMF0gPT09ICd0ZXh0JyAmJiBsYXN0VG9rZW4gJiYgbGFzdFRva2VuWzBdID09PSAndGV4dCcpIHtcbiAgICAgICAgICBsYXN0VG9rZW5bMV0gKz0gdG9rZW5bMV07XG4gICAgICAgICAgbGFzdFRva2VuWzNdID0gdG9rZW5bM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3F1YXNoZWRUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgbGFzdFRva2VuID0gdG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3F1YXNoZWRUb2tlbnM7XG4gIH1cblxuICAvKipcbiAgICogRm9ybXMgdGhlIGdpdmVuIGFycmF5IG9mIGB0b2tlbnNgIGludG8gYSBuZXN0ZWQgdHJlZSBzdHJ1Y3R1cmUgd2hlcmVcbiAgICogdG9rZW5zIHRoYXQgcmVwcmVzZW50IGEgc2VjdGlvbiBoYXZlIHR3byBhZGRpdGlvbmFsIGl0ZW1zOiAxKSBhbiBhcnJheSBvZlxuICAgKiBhbGwgdG9rZW5zIHRoYXQgYXBwZWFyIGluIHRoYXQgc2VjdGlvbiBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbFxuICAgKiB0ZW1wbGF0ZSB0aGF0IHJlcHJlc2VudHMgdGhlIGVuZCBvZiB0aGF0IHNlY3Rpb24uXG4gICAqL1xuICBmdW5jdGlvbiBuZXN0VG9rZW5zICh0b2tlbnMpIHtcbiAgICB2YXIgbmVzdGVkVG9rZW5zID0gW107XG4gICAgdmFyIGNvbGxlY3RvciA9IG5lc3RlZFRva2VucztcbiAgICB2YXIgc2VjdGlvbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgc2VjdGlvbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgc3dpdGNoICh0b2tlblswXSkge1xuICAgICAgY2FzZSAnIyc6XG4gICAgICBjYXNlICdeJzpcbiAgICAgICAgY29sbGVjdG9yLnB1c2godG9rZW4pO1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgc2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuICAgICAgICBzZWN0aW9uWzVdID0gdG9rZW5bMl07XG4gICAgICAgIGNvbGxlY3RvciA9IHNlY3Rpb25zLmxlbmd0aCA+IDAgPyBzZWN0aW9uc1tzZWN0aW9ucy5sZW5ndGggLSAxXVs0XSA6IG5lc3RlZFRva2VucztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsZSBzdHJpbmcgc2Nhbm5lciB0aGF0IGlzIHVzZWQgYnkgdGhlIHRlbXBsYXRlIHBhcnNlciB0byBmaW5kXG4gICAqIHRva2VucyBpbiB0ZW1wbGF0ZSBzdHJpbmdzLlxuICAgKi9cbiAgZnVuY3Rpb24gU2Nhbm5lciAoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiBlb3MgKCkge1xuICAgIHJldHVybiB0aGlzLnRhaWwgPT09ICcnO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiBzY2FuIChyZSkge1xuICAgIHZhciBtYXRjaCA9IHRoaXMudGFpbC5tYXRjaChyZSk7XG5cbiAgICBpZiAoIW1hdGNoIHx8IG1hdGNoLmluZGV4ICE9PSAwKVxuICAgICAgcmV0dXJuICcnO1xuXG4gICAgdmFyIHN0cmluZyA9IG1hdGNoWzBdO1xuXG4gICAgdGhpcy50YWlsID0gdGhpcy50YWlsLnN1YnN0cmluZyhzdHJpbmcubGVuZ3RoKTtcbiAgICB0aGlzLnBvcyArPSBzdHJpbmcubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICogU2tpcHMgYWxsIHRleHQgdW50aWwgdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgbWF0Y2hlZC4gUmV0dXJuc1xuICAgKiB0aGUgc2tpcHBlZCBzdHJpbmcsIHdoaWNoIGlzIHRoZSBlbnRpcmUgdGFpbCBpZiBubyBtYXRjaCBjYW4gYmUgbWFkZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW5VbnRpbCA9IGZ1bmN0aW9uIHNjYW5VbnRpbCAocmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnRhaWwuc2VhcmNoKHJlKSwgbWF0Y2g7XG5cbiAgICBzd2l0Y2ggKGluZGV4KSB7XG4gICAgY2FzZSAtMTpcbiAgICAgIG1hdGNoID0gdGhpcy50YWlsO1xuICAgICAgdGhpcy50YWlsID0gJyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDA6XG4gICAgICBtYXRjaCA9ICcnO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG1hdGNoID0gdGhpcy50YWlsLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKGluZGV4KTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBtYXRjaC5sZW5ndGg7XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSByZW5kZXJpbmcgY29udGV4dCBieSB3cmFwcGluZyBhIHZpZXcgb2JqZWN0IGFuZFxuICAgKiBtYWludGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgcGFyZW50IGNvbnRleHQuXG4gICAqL1xuICBmdW5jdGlvbiBDb250ZXh0ICh2aWV3LCBwYXJlbnRDb250ZXh0KSB7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLmNhY2hlID0geyAnLic6IHRoaXMudmlldyB9O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50Q29udGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNvbnRleHQgdXNpbmcgdGhlIGdpdmVuIHZpZXcgd2l0aCB0aGlzIGNvbnRleHRcbiAgICogYXMgdGhlIHBhcmVudC5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gbmFtZSBpbiB0aGlzIGNvbnRleHQsIHRyYXZlcnNpbmdcbiAgICogdXAgdGhlIGNvbnRleHQgaGllcmFyY2h5IGlmIHRoZSB2YWx1ZSBpcyBhYnNlbnQgaW4gdGhpcyBjb250ZXh0J3Mgdmlldy5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIGxvb2t1cCAobmFtZSkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGU7XG5cbiAgICB2YXIgdmFsdWU7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKHZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSlcbiAgICAgICAgICAgICAgbG9va3VwSGl0ID0gaGFzUHJvcGVydHkodmFsdWUsIG5hbWVzW2luZGV4XSk7XG5cbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWVbbmFtZXNbaW5kZXgrK11dO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlld1tuYW1lXTtcbiAgICAgICAgICBsb29rdXBIaXQgPSBoYXNQcm9wZXJ0eShjb250ZXh0LnZpZXcsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvb2t1cEhpdClcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIGNhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKVxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKHRoaXMudmlldyk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgV3JpdGVyIGtub3dzIGhvdyB0byB0YWtlIGEgc3RyZWFtIG9mIHRva2VucyBhbmQgcmVuZGVyIHRoZW0gdG8gYVxuICAgKiBzdHJpbmcsIGdpdmVuIGEgY29udGV4dC4gSXQgYWxzbyBtYWludGFpbnMgYSBjYWNoZSBvZiB0ZW1wbGF0ZXMgdG9cbiAgICogYXZvaWQgdGhlIG5lZWQgdG8gcGFyc2UgdGhlIHNhbWUgdGVtcGxhdGUgdHdpY2UuXG4gICAqL1xuICBmdW5jdGlvbiBXcml0ZXIgKCkge1xuICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhpcyB3cml0ZXIuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICB0aGlzLmNhY2hlID0ge307XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIGFuZCByZXR1cm5zIHRoZSBhcnJheSBvZiB0b2tlbnNcbiAgICogdGhhdCBpcyBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyc2UuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcbiAgICB2YXIgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdO1xuXG4gICAgaWYgKHRva2VucyA9PSBudWxsKVxuICAgICAgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdGFncyk7XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlciAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgdmFyIHRva2VucyA9IHRoaXMucGFyc2UodGVtcGxhdGUpO1xuICAgIHZhciBjb250ZXh0ID0gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3KTtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5zLCBjb250ZXh0LCBwYXJ0aWFscywgdGVtcGxhdGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgbWV0aG9kIHRoYXQgcmVuZGVycyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgdXNpbmdcbiAgICogdGhlIGdpdmVuIGBjb250ZXh0YCBhbmQgYHBhcnRpYWxzYC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBvcmlnaW5hbFRlbXBsYXRlYCBpcyBvbmx5IGV2ZXIgdXNlZCB0byBleHRyYWN0IHRoZSBwb3J0aW9uXG4gICAqIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHdhcyBjb250YWluZWQgaW4gYSBoaWdoZXItb3JkZXIgc2VjdGlvbi5cbiAgICogSWYgdGhlIHRlbXBsYXRlIGRvZXNuJ3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucywgdGhpcyBhcmd1bWVudCBtYXlcbiAgICogYmUgb21pdHRlZC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyVG9rZW5zID0gZnVuY3Rpb24gcmVuZGVyVG9rZW5zICh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIGJ1ZmZlciA9ICcnO1xuXG4gICAgdmFyIHRva2VuLCBzeW1ib2wsIHZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICBzeW1ib2wgPSB0b2tlblswXTtcblxuICAgICAgaWYgKHN5bWJvbCA9PT0gJyMnKSB2YWx1ZSA9IHRoaXMucmVuZGVyU2VjdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnXicpIHZhbHVlID0gdGhpcy5yZW5kZXJJbnZlcnRlZCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5yZW5kZXJQYXJ0aWFsKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICcmJykgdmFsdWUgPSB0aGlzLnVuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ25hbWUnKSB2YWx1ZSA9IHRoaXMuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ3RleHQnKSB2YWx1ZSA9IHRoaXMucmF3VmFsdWUodG9rZW4pO1xuXG4gICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZClcbiAgICAgICAgYnVmZmVyICs9IHZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJTZWN0aW9uID0gZnVuY3Rpb24gcmVuZGVyU2VjdGlvbiAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlciAodGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBzZWxmLnJlbmRlcih0ZW1wbGF0ZSwgY29udGV4dCwgcGFydGlhbHMpO1xuICAgIH1cblxuICAgIGlmICghdmFsdWUpIHJldHVybjtcblxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgZm9yICh2YXIgaiA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBqIDwgdmFsdWVMZW5ndGg7ICsraikge1xuICAgICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZVtqXSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVGVtcGxhdGUgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zIHdpdGhvdXQgdGhlIG9yaWdpbmFsIHRlbXBsYXRlJyk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHBvcnRpb24gb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgdGhlIHNlY3Rpb24gY29udGFpbnMuXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCBvcmlnaW5hbFRlbXBsYXRlLnNsaWNlKHRva2VuWzNdLCB0b2tlbls1XSksIHN1YlJlbmRlcik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVySW52ZXJ0ZWQgPSBmdW5jdGlvbiByZW5kZXJJbnZlcnRlZCAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuXG4gICAgLy8gVXNlIEphdmFTY3JpcHQncyBkZWZpbml0aW9uIG9mIGZhbHN5LiBJbmNsdWRlIGVtcHR5IGFycmF5cy5cbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4NlxuICAgIGlmICghdmFsdWUgfHwgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpXG4gICAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclBhcnRpYWwgPSBmdW5jdGlvbiByZW5kZXJQYXJ0aWFsICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMpIHtcbiAgICBpZiAoIXBhcnRpYWxzKSByZXR1cm47XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0aGlzLnBhcnNlKHZhbHVlKSwgY29udGV4dCwgcGFydGlhbHMsIHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnVuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gdW5lc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gZXNjYXBlZFZhbHVlICh0b2tlbiwgY29udGV4dCkge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiBtdXN0YWNoZS5lc2NhcGUodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmF3VmFsdWUgPSBmdW5jdGlvbiByYXdWYWx1ZSAodG9rZW4pIHtcbiAgICByZXR1cm4gdG9rZW5bMV07XG4gIH07XG5cbiAgbXVzdGFjaGUubmFtZSA9ICdtdXN0YWNoZS5qcyc7XG4gIG11c3RhY2hlLnZlcnNpb24gPSAnMi4xLjMnO1xuICBtdXN0YWNoZS50YWdzID0gWyAne3snLCAnfX0nIF07XG5cbiAgLy8gQWxsIGhpZ2gtbGV2ZWwgbXVzdGFjaGUuKiBmdW5jdGlvbnMgdXNlIHRoaXMgd3JpdGVyLlxuICB2YXIgZGVmYXVsdFdyaXRlciA9IG5ldyBXcml0ZXIoKTtcblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCBjYWNoZWQgdGVtcGxhdGVzIGluIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5jbGVhckNhY2hlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpbiB0aGUgZGVmYXVsdCB3cml0ZXIgYW5kIHJldHVybnMgdGhlXG4gICAqIGFycmF5IG9mIHRva2VucyBpdCBjb250YWlucy4gRG9pbmcgdGhpcyBhaGVhZCBvZiB0aW1lIGF2b2lkcyB0aGUgbmVlZCB0b1xuICAgKiBwYXJzZSB0ZW1wbGF0ZXMgb24gdGhlIGZseSBhcyB0aGV5IGFyZSByZW5kZXJlZC5cbiAgICovXG4gIG11c3RhY2hlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXJzIHRoZSBgdGVtcGxhdGVgIHdpdGggdGhlIGdpdmVuIGB2aWV3YCBhbmQgYHBhcnRpYWxzYCB1c2luZyB0aGVcbiAgICogZGVmYXVsdCB3cml0ZXIuXG4gICAqL1xuICBtdXN0YWNoZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscykge1xuICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHRlbXBsYXRlISBUZW1wbGF0ZSBzaG91bGQgYmUgYSBcInN0cmluZ1wiICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0IFwiJyArIHR5cGVTdHIodGVtcGxhdGUpICsgJ1wiIHdhcyBnaXZlbiBhcyB0aGUgZmlyc3QgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcmd1bWVudCBmb3IgbXVzdGFjaGUjcmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyknKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKTtcbiAgfTtcblxuICAvLyBUaGlzIGlzIGhlcmUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggMC40LnguLFxuICAvKmVzbGludC1kaXNhYmxlICovIC8vIGVzbGludCB3YW50cyBjYW1lbCBjYXNlZCBmdW5jdGlvbiBuYW1lXG4gIG11c3RhY2hlLnRvX2h0bWwgPSBmdW5jdGlvbiB0b19odG1sICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIHNlbmQpIHtcbiAgICAvKmVzbGludC1lbmFibGUqL1xuXG4gICAgdmFyIHJlc3VsdCA9IG11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oc2VuZCkpIHtcbiAgICAgIHNlbmQocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBlc2NhcGluZyBmdW5jdGlvbiBzbyB0aGF0IHRoZSB1c2VyIG1heSBvdmVycmlkZSBpdC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8yNDRcbiAgbXVzdGFjaGUuZXNjYXBlID0gZXNjYXBlSHRtbDtcblxuICAvLyBFeHBvcnQgdGhlc2UgbWFpbmx5IGZvciB0ZXN0aW5nLCBidXQgYWxzbyBmb3IgYWR2YW5jZWQgdXNhZ2UuXG4gIG11c3RhY2hlLlNjYW5uZXIgPSBTY2FubmVyO1xuICBtdXN0YWNoZS5Db250ZXh0ID0gQ29udGV4dDtcbiAgbXVzdGFjaGUuV3JpdGVyID0gV3JpdGVyO1xuXG59KSk7XG4iLCIvLyBDTEkgLSBWaWV3XG52YXIgQ0xJID0gcmVxdWlyZShcIi4vY2xpLmpzXCIpO1xudmFyIGRhdGEgPSByZXF1aXJlKFwiLi9kYXRhLmpzXCIpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZShcIi4uL3RlbXBsYXRlL2xzLmpzXCIpO1xuXG52YXIgbXUgPSByZXF1aXJlKFwibXVzdGFjaGVcIik7XG5cbi8vIG11LnJvb3QgPSBcIi4uL3RlbXBsYXRlXCJcblxudmFyIGNsaSA9IG5ldyBDTEkoZGF0YSwgXCJyb290XCIsIFwia2hhbGVkXCIpO1xuXG5cbmZ1bmN0aW9uIERpc3BsYXkoc2NyZWVuKSB7XG4gICAgdmFyIFVQX0tFWSA9IDM4LFxuICAgICAgICBET1dOX0tFWSA9IDQwLFxuICAgICAgICBFTlRFUl9LRVkgPSAxMyxcbiAgICAgICAgTUVUQV9LRVkgPSA5MSxcbiAgICAgICAgLy9sZXR0ZXIgayBpbiB0aGUga2V5Ym9hcmRcbiAgICAgICAgS19LRVkgPSA3NTtcblxuICAgIC8vIFRvIHRyYWNrIGxvY2F0aW9uIGluIGxhc3RDb21tYW5kIFtdIGJ5IHVwL2Rvd24gYXJyb3cgXG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG5cbiAgICAvLyBNYWluIEVsZW1lbnQgIFxuICAgIHRoaXMudGVybWluYWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMucmVzdWx0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLmlucHV0RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLmlucHV0RW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZW1cIik7XG4gICAgdGhpcy5pbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcbiAgICBcbiAgICAvLyBXaGVuIHVzZXIgZW50ZXIgc29tZXRoaW5nIFxuICAgIHRoaXMuaW5wdXRFbS5pbm5lckhUTUwgPSBjbGkud29ya2luZ0RpcmVjdG9yeSArIFwiICRcIjtcbiAgICB0aGlzLmlucHV0RGl2LmNsYXNzTmFtZSA9IFwiaW5wdXREaXZcIjtcbiAgICB0aGlzLnRlcm1pbmFsLmNsYXNzTmFtZSA9IFwidGVybWluYWxcIjtcbiAgICB0aGlzLnRlcm1pbmFsLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIDEpXG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICBcbiAgICAvLyBMaXN0ZW4gdG8ga2V5c3Ryb2tlcyBpbnNpZGUgdGVybWluYWwgc2NyZWVuICsgKEhlbHAgZm9jdXMgdG8gdGhlIGlucHV0KVxuICAgIHRoaXMudGVybWluYWwub25rZXlkb3duID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2ggKGUud2hpY2gpIHtcbiAgICAgICAgICAgIGNhc2UgRU5URVJfS0VZOlxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuaW5wdXQuZm9jdXMoKTtcbiAgICB9XG5cbiAgICAvL2NhcHR1cmUga2V5IHN0cm9rZXMgaW5zaWRlIGlucHV0XG4gICAgdGhpcy5pbnB1dC5vbmtleXVwID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2ggKGUud2hpY2gpIHtcbiAgICAgICAgICAgIGNhc2UgRU5URVJfS0VZOlxuICAgICAgICAgICAgICAgIHNlbGYuZW50ZXIoZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFVQX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLnVwa2V5KGUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBET1dOX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLmRvd25rZXkoZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIChlLmN0cmxLZXkgJiYgS19LRVkpOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicHJlc3Nlc1wiKVxuICAgICAgICAgICAgICAgIHNlbGYuY2xlYXIoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgZS5tZXRhS2V5OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiTUVUQUtFWVwiKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJlXCIsIGUubWV0YUtleSwgZS5jdHJsS2V5ICwgZS53aGljaCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZVwiLCBlKTtcbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBzY3JvbGwgdG8gdGhlIGJvdHRvbSBcbiAgICAgICAgLy8gd2luZG93LnNjcm9sbFRvKDAsIGRvY3VtZW50LmJvZHkub2Zmc2V0SGVpZ2h0KTtcbiAgICAgICAgc2VsZi50ZXJtaW5hbC5zY3JvbGxUb3AgPSBzZWxmLnRlcm1pbmFsLnNjcm9sbEhlaWdodDtcbiAgICB9XG5cbiAgICAvL0FwcGVuZCB0byB0aGUgdGVybWluYWwgXG4gICAgdGhpcy50ZXJtaW5hbC5hcHBlbmRDaGlsZCh0aGlzLnJlc3VsdCk7XG4gICAgdGhpcy5pbnB1dERpdi5hcHBlbmRDaGlsZCh0aGlzLmlucHV0RW0pO1xuICAgIHRoaXMuaW5wdXREaXYuYXBwZW5kQ2hpbGQodGhpcy5pbnB1dCk7XG4gICAgdGhpcy50ZXJtaW5hbC5hcHBlbmRDaGlsZCh0aGlzLmlucHV0RGl2KVxuICAgIHNjcmVlbi5hcHBlbmRDaGlsZCh0aGlzLnRlcm1pbmFsKVxuXG59XG5cblxuXG4vLyBQcm90b3R5cGUgQ2hhaW5cbkRpc3BsYXkucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZXN1bHQuaW5uZXJIVE1MID0gXCJcIjtcbiAgICB0aGlzLmlucHV0LnZhbHVlID0gXCJcIjtcbiAgICByZXR1cm47XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmVudGVyID0gZnVuY3Rpb24oZSkge1xuICAgIC8vR1VJIEFmZmVjdCBDb21tYW5kcyBcbiAgICBpZiAodGhpcy5pbnB1dC52YWx1ZSA9PSBcImNsZWFyXCIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB2YXIgdmlldyA9IHRoaXMuZ2V0Vmlldyh0aGlzLmlucHV0LnZhbHVlKTtcblxuICAgIHRoaXMucmVzdWx0Lmluc2VydEFkamFjZW50SFRNTChcImJlZm9yZWVuZFwiLCB2aWV3KVxuXG4gICAgLy9yZXNldFxuICAgIHRoaXMuaW5wdXRFbS5pbm5lckhUTUwgPSBjbGkud29ya2luZ0RpcmVjdG9yeSArIFwiICRcIjtcbiAgICB0aGlzLmlucHV0LnZhbHVlID0gJyc7XG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLnVwa2V5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxldFdoZXJlID0gdGhpcy53aGVyZSAtIDE7XG4gICAgaWYgKGxldFdoZXJlID4gLTEgJiYgbGV0V2hlcmUgPCBjbGkubGFzdENvbW1hbmQubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaW5wdXQudmFsdWUgPSBjbGkubGFzdENvbW1hbmRbLS10aGlzLndoZXJlXTtcbiAgICAgICAgLy9zdGFydCBmcm9tIHRoZSBlbmQgXG4gICAgICAgIHZhciBsZW4gPSB0aGlzLmlucHV0LnZhbHVlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5pbnB1dC5zZXRTZWxlY3Rpb25SYW5nZShsZW4sIGxlbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmRvd25rZXkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGV0V2hlcmUgPSB0aGlzLndoZXJlICsgMTtcbiAgICBpZiAobGV0V2hlcmUgPiAtMSAmJiBsZXRXaGVyZSA8IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5pbnB1dC52YWx1ZSA9IGNsaS5sYXN0Q29tbWFuZFsrK3RoaXMud2hlcmVdO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhY2hlZCB0aGUgbGltaXQgcmVzZXQgXG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG4gICAgdGhpcy5pbnB1dC52YWx1ZSA9ICcnO1xufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5nZXRWaWV3ID0gZnVuY3Rpb24oY29tbWFuZCkge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZpZXdIZWxwZXIoY2xpLnJ1bihjb21tYW5kKSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZpZXdIZWxwZXIoZS5tZXNzYWdlKTtcbiAgICB9XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmdldFZpZXdIZWxwZXIgPSBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICB2YXIgb2JqID0ge1xuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjbGkud29ya2luZ0RpcmVjdG9yeSxcbiAgICAgICAgY29tbWFuZDogY2xpLmxhc3RDb21tYW5kW2NsaS5sYXN0Q29tbWFuZC5sZW5ndGggLSAxXSxcbiAgICAgICAgcmVzdWx0OiByZXN1bHRcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc09iamVjdChyZXN1bHQpKSB7XG4gICAgICAgIG9iai5pc0NvbXBhbnkgPSBvYmoucmVzdWx0LmNvbXBhbnkgPyB0cnVlIDogZmFsc2U7XG4gICAgICAgIHJldHVybiBtdS50b19odG1sKHRlbXBsYXRlLnNlY3Rpb24sIG9iaik7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0KSkge1xuICAgICAgICBvYmoucmVzdWx0ID0gb2JqLnJlc3VsdC5qb2luKFwiJm5ic3A7Jm5ic3A7XCIpO1xuICAgICAgICByZXR1cm4gbXUudG9faHRtbCh0ZW1wbGF0ZS5saXN0LCBvYmopO1xuICAgIH1cblxuICAgIHJldHVybiBtdS50b19odG1sKHRlbXBsYXRlLmxpc3QsIG9iaik7XG59O1xuXG5EaXNwbGF5LnByb3RvdHlwZS5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmICFBcnJheS5pc0FycmF5KG9iaikgJiYgb2JqICE9PSBudWxsO1xufTtcbiIsIi8vQ0xJIC0gTW9kZWwgXG5cbmZ1bmN0aW9uIFN0b3JhZ2UoZGF0YSkge1xuICAgIHRoaXMuZGlyZWN0b3J5ID0gZGF0YSB8fCB7fTtcbn1cblxuXG5TdG9yYWdlLnByb3RvdHlwZS5kaXIgPSBmdW5jdGlvbihwd2QsIGRpcmVjdG9yeSkge1xuICAgIHZhciBjdXJyRGlyID0gdGhpcy5kaXJlY3Rvcnk7XG4gICAgdmFyIGRpcmVjdG9yeSA9IGRpcmVjdG9yeSB8fCBmYWxzZTsgXG4gICAgLy9pZiBkaXJlY3RvcnkgaXMgbm90IGdpdmVuIFxuICAgIHZhciBzdWJEaXIgPSBwd2Quc3BsaXQoJy8nKTtcbiAgICBzdWJEaXIuc2hpZnQoKTsgLy9yZW1vdmVzIHRoaXMucm9vdCBcbiAgICBpZiAocHdkID09ICcnIHx8IHB3ZCA9PSB1bmRlZmluZWQgfHwgcHdkID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJEaXI7XG4gICAgfVxuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YkRpci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXRoaXMuaGFzKGN1cnJEaXIsIHN1YkRpcltpXSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiBUaGUgZGlyZWN0b3J5ICdcIiArIHN1YkRpcltpXSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlyZWN0b3J5KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNEaXJlY3RvcnkoY3VyckRpcltzdWJEaXJbaV1dKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiAnXCIgKyBzdWJEaXJbaV0gICtcIicgaXMgbm90IGEgZGlyZWN0b3J5XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjdXJyRGlyID0gY3VyckRpcltzdWJEaXJbaV1dXG4gICAgfVxuICAgIHJldHVybiBjdXJyRGlyO1xufTtcblxuXG5TdG9yYWdlLnByb3RvdHlwZS5saXN0ID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgdmFyIGxpc3QgPSBbXTtcbiAgICB2YXIgZGlyID0gdGhpcy5kaXIocHdkKTtcblxuICAgIGZvciAodmFyIGkgaW4gZGlyKSB7XG4gICAgICAgIGlmIChkaXIuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgICAgIGlmIChpICE9IFwiZGlyZWN0b3J5XCIpXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGkpXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGxpc3Q7XG59O1xuXG5TdG9yYWdlLnByb3RvdHlwZS5pc0RpcmVjdG9yeSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoXCJkaXJlY3RvcnlcIikpIHtcbiAgICAgICAgaWYgKG9ialtcImRpcmVjdG9yeVwiXSA9PSBmYWxzZSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cblN0b3JhZ2UucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGRpciwgc3ViRGlyKSB7XG4gICAgaWYgKGRpci5oYXNPd25Qcm9wZXJ0eShzdWJEaXIpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdG9yYWdlO1xuIiwiLy8gQ0xJIC0gQ29udHJvbGxlclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKFwiLi9TdG9yYWdlLmpzXCIpO1xuXG4vLyBDTEkgLSBTaW1wbGUgdGhlIHJ1bm5lciBDb250cm9sbGVyIFxuZnVuY3Rpb24gQ0xJKGRhdGEsIHJvb3QsIG93bmVyKSB7XG4gICAgLy91c2VyIGluZm8gXG4gICAgdGhpcy5vd25lciA9IG93bmVyO1xuICAgIHRoaXMucm9vdCAgPSByb290IHx8IFwicm9vdFwiO1xuICAgIC8vcHdkIFxuICAgIHRoaXMud29ya2luZ0RpcmVjdG9yeSA9IG93bmVyIHx8IHRoaXMucm9vdCA7XG4gICAgLy9jb21tYW5kcyBzdG9yYWdlXG4gICAgdGhpcy5sYXN0Q29tbWFuZCA9IFtdO1xuICAgIHRoaXMuY29tbWFuZHMgPSBbXCJsc1wiLCBcImhlbHBcIiwgXCI/XCIsIFwiY2RcIiwgXCJjYXRcIiwgXCJwd2RcIiwgXCJvcGVuXCJdO1xuICAgIC8vdGhlIGRhdGEgb2JqZWN0IFxuICAgIHRoaXMuZGF0YSA9IG5ldyBTdG9yYWdlKGRhdGEpO1xufVxuXG4vL0NMSSAtIEJlZ2luIFByb3RvdHlwZSBcbkNMSS5wcm90b3R5cGUuc2V0UHdkID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgdGhpcy53b3JraW5nRGlyZWN0b3J5ID0gdGhpcy5jbGVhblB3ZChwd2QpO1xufVxuXG5DTEkucHJvdG90eXBlLmNsZWFuUHdkID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgdmFyIGxpc3REaXJlY3RvcnkgPSBwd2Quc3BsaXQoL1tcXHN8XFwvXS8pOyAvLyAuIHwgc3BhY2UgfCBzbGFzaCAgXG4gICAgZm9yICh2YXIgaSA9IGxpc3REaXJlY3RvcnkubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgaWYgKGxpc3REaXJlY3RvcnlbaV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBsaXN0RGlyZWN0b3J5LnNwbGljZShpLCAxKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvL2NsZWFuIHB3ZCBmcm9tIHNwYWNlcy9zbGFzaGVzIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmsocHdkKVxuICAgIHJldHVybiBsaXN0RGlyZWN0b3J5LmpvaW4oJy8nKTtcbn0sXG5DTEkucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBhcmcgPSBpbnB1dC5zcGxpdCgvXFxzKy8pOyAvL3JlbW92aW5nIHVubmVjZXNzYXJ5IHNwYWNlcyBcbiAgICB2YXIgY29tbWFuZCA9IGFyZ1swXS50b0xvd2VyQ2FzZSgpOyAvL1xuICAgIHZhciBwd2QgPSBhcmdbMV0gPyB0aGlzLmNsZWFuUHdkKGFyZ1sxXSkgOiB0aGlzLndvcmtpbmdEaXJlY3Rvcnk7XG5cbiAgICB0aGlzLmxhc3RDb21tYW5kLnB1c2goaW5wdXQpOyBcblxuICAgIGlmICh0aGlzLmNvbW1hbmRzLmluZGV4T2YoY29tbWFuZCkgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJVbmtub3duIGNvbW1hbmQgJ1wiICsgY29tbWFuZCArIFwiJ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMub3B0aW9uKGNvbW1hbmQsIHB3ZClcbn0sXG5DTEkucHJvdG90eXBlLm9wdGlvbiA9IGZ1bmN0aW9uKGNvbW1hbmQsIHB3ZCkge1xuICAgIHN3aXRjaCAoY29tbWFuZCkge1xuICAgICAgICBjYXNlICdscyc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5scyhwd2QpO1xuICAgICAgICBjYXNlICc/JzpcbiAgICAgICAgY2FzZSAnaGVscCc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oZWxwKHB3ZCk7XG4gICAgICAgIGNhc2UgJ2NkJzpcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNkKHB3ZCk7XG4gICAgICAgIGNhc2UgJ2NhdCc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jYXQocHdkKTtcbiAgICAgICAgY2FzZSAnb3Blbic6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcGVuKHB3ZCk7XG4gICAgICAgIGNhc2UgJ3B3ZCc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wd2QocHdkKVxuICAgIH1cblxufVxuQ0xJLnByb3RvdHlwZS5scyA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIGlmKHB3ZCAhPT0gdGhpcy53b3JraW5nRGlyZWN0b3J5KVxuICAgICAgICBwd2QgPSB0aGlzLmNsZWFuUHdkKHRoaXMud29ya2luZ0RpcmVjdG9yeSArICcvJyArIHB3ZCk7XG5cbiAgICBmaWxlID0gdGhpcy5kYXRhLmRpcihwd2QpO1xuXG4gICAgaWYgKCF0aGlzLmRhdGEuaXNEaXJlY3RvcnkoZmlsZSkpIHtcbiAgICAgICAgcmV0dXJuIHB3ZC5zcGxpdCgnLycpWzFdO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmRhdGEubGlzdChwd2QpO1xufVxuQ0xJLnByb3RvdHlwZS5oZWxwID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgcmV0dXJuIChcIiAgIDxwcmU+IFdlbGNvbWUgdG8gXCIrdGhpcy5vd25lcitcIidzIHNlcnZlciB2aWEgdGhlIHRlcm1pbmFsXFxuXCIrXG4gICAgICAgICAgICBcIiAgID8sIGhlbHAgOiBzaG93cyBzb21lIGhlbHBmdWwgY29tbWFuZHMuXFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgIGNkIDogY2hhbmdlIGRpcmVjdG9yeS5cXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgICAgbHMgOiBsaXN0IGRpcmVjdG9yeSBjb250ZW50cyBcXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgICBwd2QgOiBvdXRwdXQgdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgICBjYXQgOiBwcmludCB0aGUgZmlsZSDwn5iJLlxcblwiICtcbiAgICAgICAgICAgIFwiICAgICAgICB2aSA6IGNvbWluZyBvdXQgc29vblxcblwiICtcbiAgICAgICAgICAgIFwiICAgICBjbGVhciA6IGNsZWFycyB0aGUgY29uc29sZS4gdHJ5IFxcJ2N0cmwra1xcJ1wiK1xuICAgICAgICAgICAgXCIgICA8L3ByZT5cIilcbiAgICAvLyByZXR1cm4gXCImbmJzcDsmbmJzcDtjZDogIDwvYnI+ICZuYnNwOyZuYnNwO2xzOiAgPGJyPiAmbmJzcDsmbmJzcDsgPC9icj4gJm5ic3A7Jm5ic3A7Y2F0OiByZWFkIGEgZmlsZSA8L2JyPiAmbmJzcDsmbmJzcDtcIjtcbn1cbkNMSS5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHZhciBwd2QgPSB0aGlzLmNsZWFuUHdkKHRoaXMud29ya2luZ0RpcmVjdG9yeSArICcvJyArIHB3ZCk7XG4gICAgdmFyIGRpciA9IHRoaXMuZGF0YS5kaXIocHdkKTtcbiAgICBpZih0aGlzLmRhdGEuaXNEaXJlY3RvcnkoZGlyKSl7XG4gICAgICAgIHRocm93IEVycm9yKFwic29ycnkgdGhlcmUgaXMgbm8gc3VwcG9ydCB0byAnb3BlbicgZGlyZWN0b3JpZXMgeWV0IDooXCIpXG4gICAgfVxuICAgIGlmKGRpci51cmwgPT0gdW5kZWZpbmVkIHx8IGRpci51cmwgPT0gbnVsbCl7XG4gICAgICAgIHRocm93IEVycm9yKFwibm8gVVJMIGlzIHNwZWNpZnkgdG8gYmUgb3BlbiFcIilcbiAgICB9XG4gICAgd2luZG93Lm9wZW4oZGlyLnVybClcbiAgICByZXR1cm4gZGlyLnVybDtcbn1cblxuQ0xJLnByb3RvdHlwZS5jYXQgPSBmdW5jdGlvbihwd2QpIHtcblx0dmFyIGZ1bGxQd2QgPSB0aGlzLmNsZWFuUHdkKHRoaXMud29ya2luZ0RpcmVjdG9yeSArICcvJyArIHB3ZCk7XG5cbiAgICB2YXIgZmlsZSA9IHRoaXMuZGF0YS5kaXIoZnVsbFB3ZCk7IFxuICAgIGlmICh0aGlzLmRhdGEuaXNEaXJlY3RvcnkoZmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2F0OiAnXCIgKyBwd2QgICtcIicgaXMgYSBkaXJlY3RvcnlcIilcbiAgICB9XG4gICAgcmV0dXJuIGZpbGU7XG59XG5cbkNMSS5wcm90b3R5cGUucHdkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFwiL1wiK3RoaXMud29ya2luZ0RpcmVjdG9yeTtcbn1cbkNMSS5wcm90b3R5cGUuY2QgPSBmdW5jdGlvbihwd2QpIHtcbiAgICBpZiAocHdkID09IFwiLi5cIikge1xuICAgICAgICB2YXIgYXJyYXlEaXJlY3RvcnkgPSB0aGlzLndvcmtpbmdEaXJlY3Rvcnkuc3BsaXQoJy8nKTtcbiAgICAgICAgaWYoYXJyYXlEaXJlY3RvcnkubGVuZ3RoID4gMSl7XG4gICAgICAgICAgICBhcnJheURpcmVjdG9yeS5wb3AoKTtcbiAgICAgICAgfVxuICAgICAgICBwd2QgPSBhcnJheURpcmVjdG9yeS5qb2luKCcvJylcbiAgICAgICAgdGhpcy53b3JraW5nRGlyZWN0b3J5ID0gcHdkO1xuICAgIH0gZWxzZSB7XG5cdCAgICB2YXIgcHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuICAgICAgICAvL2NoZWNrIGlmIHRoZSBwd2QgaXMgYSBkaXJlY3RvcnkgXG4gICAgICAgIHRoaXMuZGF0YS5kaXIocHdkLCB0cnVlKTtcblxuICAgICAgICB0aGlzLndvcmtpbmdEaXJlY3RvcnkgPSBwd2Q7IFxuICAgIH1cblxuICAgIHRoaXMuc2V0UHdkKHRoaXMud29ya2luZ0RpcmVjdG9yeSk7XG5cbiAgICByZXR1cm4gJyc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ0xJOyBcbiIsIi8vRXhwZXJpZW5jZSBcbnZhciBURkEgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJUZWFjaCBGb3IgQW1lcmljYVwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiRnJvbnQtRW5kIERldmVsb3BlclwiLFxuICAgIFwiZGV0YWlsXCI6IFtcIkxvdCBvZiBKYXZhU3JpcHQsIEhUTUwsICYgQ1NTXCJdLFxuICAgIFwibG9jYXRpb25cIjogXCJOWUMsIE5ldyBZb3JrXCIsXG4gICAgXCJwZXJpb2RcIjogXCJBdWd1c3QtRGVjZW1iZXIgYDE0XCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL3d3dy50ZWFjaGZvcmFtZXJpY2Eub3JnL1wiLFxuICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlXG59XG5cbnZhciBBQkMgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJBQkMgR2xvYmFsIFN5c3RlbVwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiU29mdHdhcmUgRGV2ZWxvcGVyXCIsXG4gICAgXCJkZXRhaWxcIjogW1wi8J+TiSBDcmVhdGUgc29mdHdhcmUgdG8gbWFuaXB1bGF0ZSBhbmQgZXh0cmFjdCBkYXRhIHVzaW5nIFJlZ2V4IEV4cHJlc3Npb24gd2l0aCBKYXZhIG9uIFVOSVggc3lzdGVtIFwiLFxuICAgICAgICBcIvCfkrsgRGV2ZWxvcGVkIHdlYiBhcHBsaWNhdGlvbnMgdXNpbmcgSFRNTC9YSFRNTCwgQ1NTIGFuZCBKYXZhU2NyaXB0IHdpdGggUEhQICZhbXA7IE15U1FMIFwiLFxuICAgICAgICBcIvCfk7AgQ3JlYXRlIGFuZCBtYW5hZ2UgQ01TIHVzaW5nIFdvcmRQcmVzcyB0byBlbnN1cmUgc2VjdXJpdHkgYW5kIGVmZmljaWVuY3kgZm9yIHRoZSBFbmQtVXNlcnNcIlxuICAgIF0sXG4gICAgXCJwZXJpb2RcIjogXCJKYW51YXJ5LUF1Z3VzdCAnMTRcIixcbiAgICBcImxvY2F0aW9uXCI6IFwiTllDLCBOZXcgWW9ya1wiLFxuICAgIFwidXJsXCI6IFwid3d3LmFiY2dsb2JhbHN5c3RlbXMuY29tL1wiLFxuICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlXG59XG5cbi8vQmluYXJ5SGVhcFxudmFyIEJpbmFyeUhlYXAgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJCaW5hcnlIZWFwXCIsXG4gICAgXCJzdWJIZWFkZXJcIjogXCJPcGVuLVNvdXJjZVwiLFxuICAgIFwiZGV0YWlsXCI6IFwiQmluYXJ5SGVhcCBJbXBsZW1lbnRhdGlvbiBhcyBCaW5hcnlUcmVlLWxpa2Ugc3RydWN0dXJlXCIsXG4gICAgXCJsb2NhdGlvblwiOiBcIkFkZW4sIFllbWVuXCIsXG4gICAgXCJwZXJpb2RcIjogXCJTZXB0ZW1iZXJcIixcbiAgICBcInVybFwiOiBcImh0dHBzOi8vZ2l0aHViLmNvbS9LaGFsZWRNb2hhbWVkUC9CaW5hcnlIZWFwXCIsXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2UsXG59XG5cbnZhciBIdWZmbWFuZENvZGluZyA9IHtcbiAgICBcImhlYWRlclwiOiBcIkh1ZmZtYW5Db2RpbmdcIixcbiAgICBcInN1YkhlYWRlclwiOiBcIk9wZW4tU291cmNlXCIsXG4gICAgXCJkZXRhaWxcIjogXCJIdWZmbWFuZENvZGluZyB1c2luZyBKUywgSFRNTCwgQ1NTIENPT0wgaHVoXCIsXG4gICAgXCJsb2NhdGlvblwiOiBcIkFkZW4sIFllbWVuXCIsXG4gICAgXCJwZXJpb2RcIjogXCJKdW5lXCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2toYWxlZG0uY29tL2h1ZmZtYW5cIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG4vL3NraWxsc1xudmFyIHNraWxscyA9IHtcbiAgICBcImhlYWRlclwiOiBcIlNraWxsc1wiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwi8J+UpyBUb29scyBJJ3ZlIHVzZWRcIixcbiAgICBcInBlcmlvZFwiOiBcIjIwMDYtXCIgKyBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkudG9TdHJpbmcoKSxcbiAgICBcImRldGFpbFwiOiBbXG4gICAgICAgIFwi4pyTIExhbmd1YWdlczogSmF2YVNjcmlwdCwgIEMrKywgSmF2YSAsICYgT3RoZXJzXCIsXG4gICAgICAgIFwi4pyTIEpTIEZyYW1ld29yazogSlF1ZXJ5LCBBbmd1bGFySlMsIEJhY2tib25lLmpzLCAmIEQzSlNcIixcbiAgICAgICAgXCLinJMgT3Blbi1Tb3VyY2U6IFdvcmRQcmVzcywgdkJ1bGx0aW4sICYgWGVuRm9ybyBcIlxuICAgIF0sXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vS2hhbGVkTW9oYW1lZFBcIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufTtcblxudmFyIGNlcnRpZmljYXRpb24gPSB7XG4gICAgXCJoZWFkZXJcIjogXCJDZXJ0aWZpY2F0aW9uXCIsXG4gICAgXCJzdWJIZWFkZXJcIjogXCJMaXN0IG9mIGNlcnRpZmljYXRpb24gKElUKVwiLFxuICAgIFwiZGV0YWlsXCI6IFtcbiAgICAgICAgXCLinJMgQ29tcFRJQSBBKyAsIENvbXBUSUEgTGljZW5zZSBNSEdDSFBCUkxGMVFRUEZcIixcbiAgICAgICAgXCLinJMgTWljcm9zb2Z0IENlcnRpZmllZCBQcm9mZXNzaW9uYWwsIE1pY3Jvc29mdCBMaWNlbnNlIEU3ODXCrTU0NzlcIixcbiAgICAgICAgXCLinJMgU2VydmVyIFZpcnR1YWxpemF0aW9uIHdpdGggV2luZG93cyBTZXJ2ZXIgSHlwZXLCrVYgYW5kIFN5c3RlbSBDZW50ZXIsIE1pY3Jvc29mdFwiXG4gICAgXSxcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG4vL2VkdWNhdGlvbiBcbnZhciBlZHVjYXRpb24gPSB7XG4gICAgICAgIFwiaGVhZGVyXCI6IFwiQnJvb2tseW4gQ29sbGVnZVwiLFxuICAgICAgICBcInN1YkhlYWRlclwiOiBcIvCfjpMgQ29tcHV0ZXIgU2NpZW5jZVwiLFxuICAgICAgICBcInBlcmlvZFwiOiBcIjIwMTAtMjAxNFwiLFxuICAgICAgICBcImRldGFpbFwiOiBbXG4gICAgICAgICAgICBcIkRlYW4gbGlzdCAnMTMgJzE0XCIsXG4gICAgICAgICAgICBcIkNTIE1lbnRvciB3aXRoIHRoZSBEZXBhcnRtZW50IG9mIENvbXB1dGVyIFNjaWVuY2VcIixcbiAgICAgICAgXSxcbiAgICAgICAgXCJkaXJlY3RvcnlcIjogZmFsc2VcbiAgICB9XG4gICAgLy9GaWxlIHN0cnVjdHVyZVxudmFyIGRpcmVjdG9yeSA9IHtcbiAgICBcImV4cGVyaWVuY2VcIjoge1xuICAgICAgICBcIlRGQVwiOiBURkEsXG4gICAgICAgIFwiQUJDXCI6IEFCQyxcbiAgICB9LFxuICAgIFwicHJvamVjdHNcIjoge1xuICAgICAgICBcIkJpbmFyeUhlYXBcIjogQmluYXJ5SGVhcCxcbiAgICAgICAgXCJIdWZmbWFuZENvZGluZ1wiOiBIdWZmbWFuZENvZGluZyxcbiAgICB9LFxuICAgIFwib3RoZXJzXCI6IHtcbiAgICAgICAgXCJlZHVjYXRpb25cIjogZWR1Y2F0aW9uLFxuICAgICAgICBcInNraWxsc1wiOiBza2lsbHMsXG4gICAgICAgIFwiY2VydGlmaWNhdGlvblwiOiBjZXJ0aWZpY2F0aW9uXG4gICAgfVxuXG59XG5tb2R1bGUuZXhwb3J0cyA9IGRpcmVjdG9yeTtcbiIsInZhciBzZWN0aW9uID0gW1wiPGRpdj5cIixcblx0XHRcdFx0XHRcIjxlbT57e3dvcmtpbmdEaXJlY3Rvcnl9fSAkIHt7Y29tbWFuZH19PC9lbT5cIixcblx0XHRcdFx0XCI8L2Rpdj5cIixcblx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJzZWN0aW9uXFxcIj5cIixcblx0XHRcdFx0XHRcIjxkaXYgY2xhc3M9XFxcImhlYWRlclxcXCI+XCIsXG5cdFx0XHRcdFx0XHRcIjxkaXYgY2xhc3M9XFxcInRpdGxlXFxcIj5cIixcblx0XHRcdFx0XHRcdFx0XCI8Yj57e3Jlc3VsdC5oZWFkZXJ9fTwvYj5cIixcblx0XHRcdFx0XHRcdFx0XCI8L2JyPlwiLFxuXHRcdFx0XHRcdFx0XHRcIjxlbT5+IHt7cmVzdWx0LnN1YkhlYWRlcn19PC9lbT5cIiwgXG5cdFx0XHRcdFx0XHRcIjwvZGl2PlwiLFxuXHRcdFx0XHRcdFx0XCI8YiBjbGFzcz1cXFwicGVyaW9kXFxcIj4gIHt7cmVzdWx0LmxvY2F0aW9ufX0gIDwvYnI+IHt7cmVzdWx0LnBlcmlvZH19PC9iPlwiLFxuXHRcdFx0XHRcdFwiPC9kaXY+XCIsXG5cdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJjbGVhcmZpeFxcXCI+PC9kaXY+IFwiLFxuXHRcdFx0XHRcdFwiPGhyPiBcIixcblx0XHRcdFx0XHRcIjxkaXYgY2xhc3M9XFxcImRldGFpbHNcXFwiPiBcIixcblx0XHRcdFx0XHRcdFwiPHVsPnt7I3Jlc3VsdC5kZXRhaWx9fSA8bGk+e3sufX08L2xpPnt7L3Jlc3VsdC5kZXRhaWx9fTwvdWw+XCIsXG5cdFx0XHRcdFx0XCI8L2Rpdj5cIixcblx0XHRcdFx0XCI8L2Rpdj5cIl0uam9pbihcIlxcblwiKTtcblxudmFyIGxpc3QgPSBbXCI8ZGl2IGNsYXNzPVxcXCJsaXN0XFxcIj4gXCIsXG5cdCAgICBcdFx0XCI8ZW0+e3t3b3JraW5nRGlyZWN0b3J5fX0gJCB7e2NvbW1hbmR9fTwvZW0+XCIsIFxuXHQgICAgXHRcdFwiPHA+e3smcmVzdWx0fX08L3A+XCIsXG4gICAgXHRcdFwiPC9kaXY+XCJdLmpvaW4oXCJcXG5cIik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHNlY3Rpb246IHNlY3Rpb24sXG4gICAgbGlzdDogbGlzdFxufSJdfQ==
