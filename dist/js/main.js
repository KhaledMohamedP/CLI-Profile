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
    var input, UP_KEY = 38,
        DOWN_KEY = 40,
        ENTER_KEY = 13,
        K_KEY = 75,
        back_key = 10;

    //to track location in lastCommand [] by up/down arrow 
    this.where = cli.lastCommand.length;

    //Main Element  
    this.terminal = document.createElement("div");
    this.result = document.createElement("div");
    this.inputDiv = document.createElement("div");
    this.inputEm = document.createElement("em");
    this.input = document.createElement("input");
    //When user enter something 
    this.inputEm.innerHTML = cli.workingDirectory + " $";
    this.inputDiv.className = "inputDiv";
    this.terminal.className = "terminal";
    this.terminal.setAttribute("tabindex", 1)

    var self = this;
    //listen to keystrokes inside terminal 
    this.terminal.onkeydown = function(e) {
        switch(e.which){
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
                self.enter(e)
                break;
            case UP_KEY:
                self.upkey(e);
                break;
            case DOWN_KEY:
                self.downkey(e);
                break;
            case e.ctrlKey && K_KEY:
                self.clear();
                break;
            default:
                break;
        }
        // Automatically scroll to the bottom 
        // window.scrollTo(0, document.body.offsetHeight);
        self.terminal.scrollTop = self.terminal.scrollHeight;
    }

    //Append to the give div
    this.terminal.appendChild(this.result);
    this.inputDiv.appendChild(this.inputEm);
    this.inputDiv.appendChild(this.input);
    this.terminal.appendChild(this.inputDiv)
    screen.appendChild(this.terminal)

}

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
        this.input.setSelectionRange(len,len);
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
}

Display.prototype.isObject = function(obj) {
    return typeof obj === "object" && !Array.isArray(obj) && obj !== null;
}




window.onload = function() {
    var elm = document.querySelector(".screen");

    var some = new Display(elm);

    //when first loaded 
    some.input.focus();
}

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
}


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
}
Storage.prototype.isDirectory = function(obj) {
    if (obj.hasOwnProperty("directory")) {
        if (obj["directory"] == false)
            return false;
    }

    return true;
}
Storage.prototype.has = function(dir, subDir) {
    if (dir.hasOwnProperty(subDir)) {
        return true
    }

    return false;
}

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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXVzdGFjaGUvbXVzdGFjaGUuanMiLCJzcmMvanMvRGlzcGxheS5qcyIsInNyYy9qcy9TdG9yYWdlLmpzIiwic3JjL2pzL2NsaS5qcyIsInNyYy9qcy9kYXRhLmpzIiwic3JjL3RlbXBsYXRlL2xzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbm5CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohXG4gKiBtdXN0YWNoZS5qcyAtIExvZ2ljLWxlc3Mge3ttdXN0YWNoZX19IHRlbXBsYXRlcyB3aXRoIEphdmFTY3JpcHRcbiAqIGh0dHA6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanNcbiAqL1xuXG4vKmdsb2JhbCBkZWZpbmU6IGZhbHNlIE11c3RhY2hlOiB0cnVlKi9cblxuKGZ1bmN0aW9uIGRlZmluZU11c3RhY2hlIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmIHR5cGVvZiBleHBvcnRzLm5vZGVOYW1lICE9PSAnc3RyaW5nJykge1xuICAgIGZhY3RvcnkoZXhwb3J0cyk7IC8vIENvbW1vbkpTXG4gIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFsnZXhwb3J0cyddLCBmYWN0b3J5KTsgLy8gQU1EXG4gIH0gZWxzZSB7XG4gICAgZ2xvYmFsLk11c3RhY2hlID0ge307XG4gICAgZmFjdG9yeShNdXN0YWNoZSk7IC8vIHNjcmlwdCwgd3NoLCBhc3BcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiBtdXN0YWNoZUZhY3RvcnkgKG11c3RhY2hlKSB7XG5cbiAgdmFyIG9iamVjdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIGlzQXJyYXlQb2x5ZmlsbCAob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdFRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICBmdW5jdGlvbiBpc0Z1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3JlIGNvcnJlY3QgdHlwZW9mIHN0cmluZyBoYW5kbGluZyBhcnJheVxuICAgKiB3aGljaCBub3JtYWxseSByZXR1cm5zIHR5cGVvZiAnb2JqZWN0J1xuICAgKi9cbiAgZnVuY3Rpb24gdHlwZVN0ciAob2JqKSB7XG4gICAgcmV0dXJuIGlzQXJyYXkob2JqKSA/ICdhcnJheScgOiB0eXBlb2Ygb2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlUmVnRXhwIChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCAnXFxcXCQmJyk7XG4gIH1cblxuICAvKipcbiAgICogTnVsbCBzYWZlIHdheSBvZiBjaGVja2luZyB3aGV0aGVyIG9yIG5vdCBhbiBvYmplY3QsXG4gICAqIGluY2x1ZGluZyBpdHMgcHJvdG90eXBlLCBoYXMgYSBnaXZlbiBwcm9wZXJ0eVxuICAgKi9cbiAgZnVuY3Rpb24gaGFzUHJvcGVydHkgKG9iaiwgcHJvcE5hbWUpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgKHByb3BOYW1lIGluIG9iaik7XG4gIH1cblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIHZhciByZWdFeHBUZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICBmdW5jdGlvbiB0ZXN0UmVnRXhwIChyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIHJlZ0V4cFRlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBub25TcGFjZVJlID0gL1xcUy87XG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZSAoc3RyaW5nKSB7XG4gICAgcmV0dXJuICF0ZXN0UmVnRXhwKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjMzk7JyxcbiAgICAnLyc6ICcmI3gyRjsnXG4gIH07XG5cbiAgZnVuY3Rpb24gZXNjYXBlSHRtbCAoc3RyaW5nKSB7XG4gICAgcmV0dXJuIFN0cmluZyhzdHJpbmcpLnJlcGxhY2UoL1smPD5cIidcXC9dL2csIGZ1bmN0aW9uIGZyb21FbnRpdHlNYXAgKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICB2YXIgd2hpdGVSZSA9IC9cXHMqLztcbiAgdmFyIHNwYWNlUmUgPSAvXFxzKy87XG4gIHZhciBlcXVhbHNSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbnMuIElmIHRoZSBgdGFnc2BcbiAgICogYXJndW1lbnQgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gWyBcIjwlXCIsIFwiJT5cIiBdKS4gT2ZcbiAgICogY291cnNlLCB0aGUgZGVmYXVsdCBpcyB0byB1c2UgbXVzdGFjaGVzIChpLmUuIG11c3RhY2hlLnRhZ3MpLlxuICAgKlxuICAgKiBBIHRva2VuIGlzIGFuIGFycmF5IHdpdGggYXQgbGVhc3QgNCBlbGVtZW50cy4gVGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlXG4gICAqIG11c3RhY2hlIHN5bWJvbCB0aGF0IHdhcyB1c2VkIGluc2lkZSB0aGUgdGFnLCBlLmcuIFwiI1wiIG9yIFwiJlwiLiBJZiB0aGUgdGFnXG4gICAqIGRpZCBub3QgY29udGFpbiBhIHN5bWJvbCAoaS5lLiB7e215VmFsdWV9fSkgdGhpcyBlbGVtZW50IGlzIFwibmFtZVwiLiBGb3JcbiAgICogYWxsIHRleHQgdGhhdCBhcHBlYXJzIG91dHNpZGUgYSBzeW1ib2wgdGhpcyBlbGVtZW50IGlzIFwidGV4dFwiLlxuICAgKlxuICAgKiBUaGUgc2Vjb25kIGVsZW1lbnQgb2YgYSB0b2tlbiBpcyBpdHMgXCJ2YWx1ZVwiLiBGb3IgbXVzdGFjaGUgdGFncyB0aGlzIGlzXG4gICAqIHdoYXRldmVyIGVsc2Ugd2FzIGluc2lkZSB0aGUgdGFnIGJlc2lkZXMgdGhlIG9wZW5pbmcgc3ltYm9sLiBGb3IgdGV4dCB0b2tlbnNcbiAgICogdGhpcyBpcyB0aGUgdGV4dCBpdHNlbGYuXG4gICAqXG4gICAqIFRoZSB0aGlyZCBhbmQgZm91cnRoIGVsZW1lbnRzIG9mIHRoZSB0b2tlbiBhcmUgdGhlIHN0YXJ0IGFuZCBlbmQgaW5kaWNlcyxcbiAgICogcmVzcGVjdGl2ZWx5LCBvZiB0aGUgdG9rZW4gaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUb2tlbnMgdGhhdCBhcmUgdGhlIHJvb3Qgbm9kZSBvZiBhIHN1YnRyZWUgY29udGFpbiB0d28gbW9yZSBlbGVtZW50czogMSkgYW5cbiAgICogYXJyYXkgb2YgdG9rZW5zIGluIHRoZSBzdWJ0cmVlIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlIGF0XG4gICAqIHdoaWNoIHRoZSBjbG9zaW5nIHRhZyBmb3IgdGhhdCBzZWN0aW9uIGJlZ2lucy5cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgaWYgKCF0ZW1wbGF0ZSlcbiAgICAgIHJldHVybiBbXTtcblxuICAgIHZhciBzZWN0aW9ucyA9IFtdOyAgICAgLy8gU3RhY2sgdG8gaG9sZCBzZWN0aW9uIHRva2Vuc1xuICAgIHZhciB0b2tlbnMgPSBbXTsgICAgICAgLy8gQnVmZmVyIHRvIGhvbGQgdGhlIHRva2Vuc1xuICAgIHZhciBzcGFjZXMgPSBbXTsgICAgICAgLy8gSW5kaWNlcyBvZiB3aGl0ZXNwYWNlIHRva2VucyBvbiB0aGUgY3VycmVudCBsaW5lXG4gICAgdmFyIGhhc1RhZyA9IGZhbHNlOyAgICAvLyBJcyB0aGVyZSBhIHt7dGFnfX0gb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgbm9uU3BhY2UgPSBmYWxzZTsgIC8vIElzIHRoZXJlIGEgbm9uLXNwYWNlIGNoYXIgb24gdGhlIGN1cnJlbnQgbGluZT9cblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSAoKSB7XG4gICAgICBpZiAoaGFzVGFnICYmICFub25TcGFjZSkge1xuICAgICAgICB3aGlsZSAoc3BhY2VzLmxlbmd0aClcbiAgICAgICAgICBkZWxldGUgdG9rZW5zW3NwYWNlcy5wb3AoKV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGFjZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaGFzVGFnID0gZmFsc2U7XG4gICAgICBub25TcGFjZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBvcGVuaW5nVGFnUmUsIGNsb3NpbmdUYWdSZSwgY2xvc2luZ0N1cmx5UmU7XG4gICAgZnVuY3Rpb24gY29tcGlsZVRhZ3MgKHRhZ3NUb0NvbXBpbGUpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFnc1RvQ29tcGlsZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHRhZ3NUb0NvbXBpbGUgPSB0YWdzVG9Db21waWxlLnNwbGl0KHNwYWNlUmUsIDIpO1xuXG4gICAgICBpZiAoIWlzQXJyYXkodGFnc1RvQ29tcGlsZSkgfHwgdGFnc1RvQ29tcGlsZS5sZW5ndGggIT09IDIpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzOiAnICsgdGFnc1RvQ29tcGlsZSk7XG5cbiAgICAgIG9wZW5pbmdUYWdSZSA9IG5ldyBSZWdFeHAoZXNjYXBlUmVnRXhwKHRhZ3NUb0NvbXBpbGVbMF0pICsgJ1xcXFxzKicpO1xuICAgICAgY2xvc2luZ1RhZ1JlID0gbmV3IFJlZ0V4cCgnXFxcXHMqJyArIGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzFdKSk7XG4gICAgICBjbG9zaW5nQ3VybHlSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAoJ30nICsgdGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgIH1cblxuICAgIGNvbXBpbGVUYWdzKHRhZ3MgfHwgbXVzdGFjaGUudGFncyk7XG5cbiAgICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRlbXBsYXRlKTtcblxuICAgIHZhciBzdGFydCwgdHlwZSwgdmFsdWUsIGNociwgdG9rZW4sIG9wZW5TZWN0aW9uO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcblxuICAgICAgLy8gTWF0Y2ggYW55IHRleHQgYmV0d2VlbiB0YWdzLlxuICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChvcGVuaW5nVGFnUmUpO1xuXG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgdmFsdWVMZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0b2tlbnMucHVzaChbICd0ZXh0JywgY2hyLCBzdGFydCwgc3RhcnQgKyAxIF0pO1xuICAgICAgICAgIHN0YXJ0ICs9IDE7XG5cbiAgICAgICAgICAvLyBDaGVjayBmb3Igd2hpdGVzcGFjZSBvbiB0aGUgY3VycmVudCBsaW5lLlxuICAgICAgICAgIGlmIChjaHIgPT09ICdcXG4nKVxuICAgICAgICAgICAgc3RyaXBTcGFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE1hdGNoIHRoZSBvcGVuaW5nIHRhZy5cbiAgICAgIGlmICghc2Nhbm5lci5zY2FuKG9wZW5pbmdUYWdSZSkpXG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBoYXNUYWcgPSB0cnVlO1xuXG4gICAgICAvLyBHZXQgdGhlIHRhZyB0eXBlLlxuICAgICAgdHlwZSA9IHNjYW5uZXIuc2Nhbih0YWdSZSkgfHwgJ25hbWUnO1xuICAgICAgc2Nhbm5lci5zY2FuKHdoaXRlUmUpO1xuXG4gICAgICAvLyBHZXQgdGhlIHRhZyB2YWx1ZS5cbiAgICAgIGlmICh0eXBlID09PSAnPScpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChlcXVhbHNSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihlcXVhbHNSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdUYWdSZSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICd7Jykge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdDdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuKGN1cmx5UmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgICB0eXBlID0gJyYnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgY2xvc2luZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihjbG9zaW5nVGFnUmUpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHRhZyBhdCAnICsgc2Nhbm5lci5wb3MpO1xuXG4gICAgICB0b2tlbiA9IFsgdHlwZSwgdmFsdWUsIHN0YXJ0LCBzY2FubmVyLnBvcyBdO1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICBpZiAodHlwZSA9PT0gJyMnIHx8IHR5cGUgPT09ICdeJykge1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJy8nKSB7XG4gICAgICAgIC8vIENoZWNrIHNlY3Rpb24gbmVzdGluZy5cbiAgICAgICAgb3BlblNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgICAgICBpZiAoIW9wZW5TZWN0aW9uKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5vcGVuZWQgc2VjdGlvbiBcIicgKyB2YWx1ZSArICdcIiBhdCAnICsgc3RhcnQpO1xuXG4gICAgICAgIGlmIChvcGVuU2VjdGlvblsxXSAhPT0gdmFsdWUpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzdGFydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICduYW1lJyB8fCB0eXBlID09PSAneycgfHwgdHlwZSA9PT0gJyYnKSB7XG4gICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIC8vIFNldCB0aGUgdGFncyBmb3IgdGhlIG5leHQgdGltZSBhcm91bmQuXG4gICAgICAgIGNvbXBpbGVUYWdzKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIG9wZW4gc2VjdGlvbnMgd2hlbiB3ZSdyZSBkb25lLlxuICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICBpZiAob3BlblNlY3Rpb24pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgb3BlblNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgIHJldHVybiBuZXN0VG9rZW5zKHNxdWFzaFRva2Vucyh0b2tlbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyB0aGUgdmFsdWVzIG9mIGNvbnNlY3V0aXZlIHRleHQgdG9rZW5zIGluIHRoZSBnaXZlbiBgdG9rZW5zYCBhcnJheVxuICAgKiB0byBhIHNpbmdsZSB0b2tlbi5cbiAgICovXG4gIGZ1bmN0aW9uIHNxdWFzaFRva2VucyAodG9rZW5zKSB7XG4gICAgdmFyIHNxdWFzaGVkVG9rZW5zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIGxhc3RUb2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIGlmICh0b2tlblswXSA9PT0gJ3RleHQnICYmIGxhc3RUb2tlbiAmJiBsYXN0VG9rZW5bMF0gPT09ICd0ZXh0Jykge1xuICAgICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgICBsYXN0VG9rZW5bM10gPSB0b2tlblszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzcXVhc2hlZFRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcXVhc2hlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtcyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgaW50byBhIG5lc3RlZCB0cmVlIHN0cnVjdHVyZSB3aGVyZVxuICAgKiB0b2tlbnMgdGhhdCByZXByZXNlbnQgYSBzZWN0aW9uIGhhdmUgdHdvIGFkZGl0aW9uYWwgaXRlbXM6IDEpIGFuIGFycmF5IG9mXG4gICAqIGFsbCB0b2tlbnMgdGhhdCBhcHBlYXIgaW4gdGhhdCBzZWN0aW9uIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsXG4gICAqIHRlbXBsYXRlIHRoYXQgcmVwcmVzZW50cyB0aGUgZW5kIG9mIHRoYXQgc2VjdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIG5lc3RUb2tlbnMgKHRva2Vucykge1xuICAgIHZhciBuZXN0ZWRUb2tlbnMgPSBbXTtcbiAgICB2YXIgY29sbGVjdG9yID0gbmVzdGVkVG9rZW5zO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuLCBzZWN0aW9uO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICBzd2l0Y2ggKHRva2VuWzBdKSB7XG4gICAgICBjYXNlICcjJzpcbiAgICAgIGNhc2UgJ14nOlxuICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICAgIHNlY3Rpb25zLnB1c2godG9rZW4pO1xuICAgICAgICBjb2xsZWN0b3IgPSB0b2tlbls0XSA9IFtdO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJy8nOlxuICAgICAgICBzZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG4gICAgICAgIHNlY3Rpb25bNV0gPSB0b2tlblsyXTtcbiAgICAgICAgY29sbGVjdG9yID0gc2VjdGlvbnMubGVuZ3RoID4gMCA/IHNlY3Rpb25zW3NlY3Rpb25zLmxlbmd0aCAtIDFdWzRdIDogbmVzdGVkVG9rZW5zO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbGxlY3Rvci5wdXNoKHRva2VuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmVzdGVkVG9rZW5zO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgc2ltcGxlIHN0cmluZyBzY2FubmVyIHRoYXQgaXMgdXNlZCBieSB0aGUgdGVtcGxhdGUgcGFyc2VyIHRvIGZpbmRcbiAgICogdG9rZW5zIGluIHRlbXBsYXRlIHN0cmluZ3MuXG4gICAqL1xuICBmdW5jdGlvbiBTY2FubmVyIChzdHJpbmcpIHtcbiAgICB0aGlzLnN0cmluZyA9IHN0cmluZztcbiAgICB0aGlzLnRhaWwgPSBzdHJpbmc7XG4gICAgdGhpcy5wb3MgPSAwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYHRydWVgIGlmIHRoZSB0YWlsIGlzIGVtcHR5IChlbmQgb2Ygc3RyaW5nKS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLmVvcyA9IGZ1bmN0aW9uIGVvcyAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFpbCA9PT0gJyc7XG4gIH07XG5cbiAgLyoqXG4gICAqIFRyaWVzIHRvIG1hdGNoIHRoZSBnaXZlbiByZWd1bGFyIGV4cHJlc3Npb24gYXQgdGhlIGN1cnJlbnQgcG9zaXRpb24uXG4gICAqIFJldHVybnMgdGhlIG1hdGNoZWQgdGV4dCBpZiBpdCBjYW4gbWF0Y2gsIHRoZSBlbXB0eSBzdHJpbmcgb3RoZXJ3aXNlLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuc2NhbiA9IGZ1bmN0aW9uIHNjYW4gKHJlKSB7XG4gICAgdmFyIG1hdGNoID0gdGhpcy50YWlsLm1hdGNoKHJlKTtcblxuICAgIGlmICghbWF0Y2ggfHwgbWF0Y2guaW5kZXggIT09IDApXG4gICAgICByZXR1cm4gJyc7XG5cbiAgICB2YXIgc3RyaW5nID0gbWF0Y2hbMF07XG5cbiAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKHN0cmluZy5sZW5ndGgpO1xuICAgIHRoaXMucG9zICs9IHN0cmluZy5sZW5ndGg7XG5cbiAgICByZXR1cm4gc3RyaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTa2lwcyBhbGwgdGV4dCB1bnRpbCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGNhbiBiZSBtYXRjaGVkLiBSZXR1cm5zXG4gICAqIHRoZSBza2lwcGVkIHN0cmluZywgd2hpY2ggaXMgdGhlIGVudGlyZSB0YWlsIGlmIG5vIG1hdGNoIGNhbiBiZSBtYWRlLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuc2NhblVudGlsID0gZnVuY3Rpb24gc2NhblVudGlsIChyZSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMudGFpbC5zZWFyY2gocmUpLCBtYXRjaDtcblxuICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICBjYXNlIC0xOlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWw7XG4gICAgICB0aGlzLnRhaWwgPSAnJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMDpcbiAgICAgIG1hdGNoID0gJyc7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgbWF0Y2ggPSB0aGlzLnRhaWwuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoaW5kZXgpO1xuICAgIH1cblxuICAgIHRoaXMucG9zICs9IG1hdGNoLmxlbmd0aDtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHJlbmRlcmluZyBjb250ZXh0IGJ5IHdyYXBwaW5nIGEgdmlldyBvYmplY3QgYW5kXG4gICAqIG1haW50YWluaW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBwYXJlbnQgY29udGV4dC5cbiAgICovXG4gIGZ1bmN0aW9uIENvbnRleHQgKHZpZXcsIHBhcmVudENvbnRleHQpIHtcbiAgICB0aGlzLnZpZXcgPSB2aWV3O1xuICAgIHRoaXMuY2FjaGUgPSB7ICcuJzogdGhpcy52aWV3IH07XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnRDb250ZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgY29udGV4dCB1c2luZyB0aGUgZ2l2ZW4gdmlldyB3aXRoIHRoaXMgY29udGV4dFxuICAgKiBhcyB0aGUgcGFyZW50LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIHB1c2ggKHZpZXcpIHtcbiAgICByZXR1cm4gbmV3IENvbnRleHQodmlldywgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBnaXZlbiBuYW1lIGluIHRoaXMgY29udGV4dCwgdHJhdmVyc2luZ1xuICAgKiB1cCB0aGUgY29udGV4dCBoaWVyYXJjaHkgaWYgdGhlIHZhbHVlIGlzIGFic2VudCBpbiB0aGlzIGNvbnRleHQncyB2aWV3LlxuICAgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gbG9va3VwIChuYW1lKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcblxuICAgIHZhciB2YWx1ZTtcbiAgICBpZiAoY2FjaGUuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgIHZhbHVlID0gY2FjaGVbbmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcywgbmFtZXMsIGluZGV4LCBsb29rdXBIaXQgPSBmYWxzZTtcblxuICAgICAgd2hpbGUgKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKG5hbWUuaW5kZXhPZignLicpID4gMCkge1xuICAgICAgICAgIHZhbHVlID0gY29udGV4dC52aWV3O1xuICAgICAgICAgIG5hbWVzID0gbmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgIGluZGV4ID0gMDtcblxuICAgICAgICAgIC8qKlxuICAgICAgICAgICAqIFVzaW5nIHRoZSBkb3Qgbm90aW9uIHBhdGggaW4gYG5hbWVgLCB3ZSBkZXNjZW5kIHRocm91Z2ggdGhlXG4gICAgICAgICAgICogbmVzdGVkIG9iamVjdHMuXG4gICAgICAgICAgICpcbiAgICAgICAgICAgKiBUbyBiZSBjZXJ0YWluIHRoYXQgdGhlIGxvb2t1cCBoYXMgYmVlbiBzdWNjZXNzZnVsLCB3ZSBoYXZlIHRvXG4gICAgICAgICAgICogY2hlY2sgaWYgdGhlIGxhc3Qgb2JqZWN0IGluIHRoZSBwYXRoIGFjdHVhbGx5IGhhcyB0aGUgcHJvcGVydHlcbiAgICAgICAgICAgKiB3ZSBhcmUgbG9va2luZyBmb3IuIFdlIHN0b3JlIHRoZSByZXN1bHQgaW4gYGxvb2t1cEhpdGAuXG4gICAgICAgICAgICpcbiAgICAgICAgICAgKiBUaGlzIGlzIHNwZWNpYWxseSBuZWNlc3NhcnkgZm9yIHdoZW4gdGhlIHZhbHVlIGhhcyBiZWVuIHNldCB0b1xuICAgICAgICAgICAqIGB1bmRlZmluZWRgIGFuZCB3ZSB3YW50IHRvIGF2b2lkIGxvb2tpbmcgdXAgcGFyZW50IGNvbnRleHRzLlxuICAgICAgICAgICAqKi9cbiAgICAgICAgICB3aGlsZSAodmFsdWUgIT0gbnVsbCAmJiBpbmRleCA8IG5hbWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGluZGV4ID09PSBuYW1lcy5sZW5ndGggLSAxKVxuICAgICAgICAgICAgICBsb29rdXBIaXQgPSBoYXNQcm9wZXJ0eSh2YWx1ZSwgbmFtZXNbaW5kZXhdKTtcblxuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZVtuYW1lc1tpbmRleCsrXV07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gY29udGV4dC52aWV3W25hbWVdO1xuICAgICAgICAgIGxvb2t1cEhpdCA9IGhhc1Byb3BlcnR5KGNvbnRleHQudmlldywgbmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9va3VwSGl0KVxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNvbnRleHQgPSBjb250ZXh0LnBhcmVudDtcbiAgICAgIH1cblxuICAgICAgY2FjaGVbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwodGhpcy52aWV3KTtcblxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQSBXcml0ZXIga25vd3MgaG93IHRvIHRha2UgYSBzdHJlYW0gb2YgdG9rZW5zIGFuZCByZW5kZXIgdGhlbSB0byBhXG4gICAqIHN0cmluZywgZ2l2ZW4gYSBjb250ZXh0LiBJdCBhbHNvIG1haW50YWlucyBhIGNhY2hlIG9mIHRlbXBsYXRlcyB0b1xuICAgKiBhdm9pZCB0aGUgbmVlZCB0byBwYXJzZSB0aGUgc2FtZSB0ZW1wbGF0ZSB0d2ljZS5cbiAgICovXG4gIGZ1bmN0aW9uIFdyaXRlciAoKSB7XG4gICAgdGhpcy5jYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgY2FjaGVkIHRlbXBsYXRlcyBpbiB0aGlzIHdyaXRlci5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUgKCkge1xuICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgYW5kIHJldHVybnMgdGhlIGFycmF5IG9mIHRva2Vuc1xuICAgKiB0aGF0IGlzIGdlbmVyYXRlZCBmcm9tIHRoZSBwYXJzZS5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlO1xuICAgIHZhciB0b2tlbnMgPSBjYWNoZVt0ZW1wbGF0ZV07XG5cbiAgICBpZiAodG9rZW5zID09IG51bGwpXG4gICAgICB0b2tlbnMgPSBjYWNoZVt0ZW1wbGF0ZV0gPSBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCB0YWdzKTtcblxuICAgIHJldHVybiB0b2tlbnM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEhpZ2gtbGV2ZWwgbWV0aG9kIHRoYXQgaXMgdXNlZCB0byByZW5kZXIgdGhlIGdpdmVuIGB0ZW1wbGF0ZWAgd2l0aFxuICAgKiB0aGUgZ2l2ZW4gYHZpZXdgLlxuICAgKlxuICAgKiBUaGUgb3B0aW9uYWwgYHBhcnRpYWxzYCBhcmd1bWVudCBtYXkgYmUgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlXG4gICAqIG5hbWVzIGFuZCB0ZW1wbGF0ZXMgb2YgcGFydGlhbHMgdGhhdCBhcmUgdXNlZCBpbiB0aGUgdGVtcGxhdGUuIEl0IG1heVxuICAgKiBhbHNvIGJlIGEgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIHRvIGxvYWQgcGFydGlhbCB0ZW1wbGF0ZXMgb24gdGhlIGZseVxuICAgKiB0aGF0IHRha2VzIGEgc2luZ2xlIGFyZ3VtZW50OiB0aGUgbmFtZSBvZiB0aGUgcGFydGlhbC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpIHtcbiAgICB2YXIgdG9rZW5zID0gdGhpcy5wYXJzZSh0ZW1wbGF0ZSk7XG4gICAgdmFyIGNvbnRleHQgPSAodmlldyBpbnN0YW5jZW9mIENvbnRleHQpID8gdmlldyA6IG5ldyBDb250ZXh0KHZpZXcpO1xuICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCB0ZW1wbGF0ZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIExvdy1sZXZlbCBtZXRob2QgdGhhdCByZW5kZXJzIHRoZSBnaXZlbiBhcnJheSBvZiBgdG9rZW5zYCB1c2luZ1xuICAgKiB0aGUgZ2l2ZW4gYGNvbnRleHRgIGFuZCBgcGFydGlhbHNgLlxuICAgKlxuICAgKiBOb3RlOiBUaGUgYG9yaWdpbmFsVGVtcGxhdGVgIGlzIG9ubHkgZXZlciB1c2VkIHRvIGV4dHJhY3QgdGhlIHBvcnRpb25cbiAgICogb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgd2FzIGNvbnRhaW5lZCBpbiBhIGhpZ2hlci1vcmRlciBzZWN0aW9uLlxuICAgKiBJZiB0aGUgdGVtcGxhdGUgZG9lc24ndCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLCB0aGlzIGFyZ3VtZW50IG1heVxuICAgKiBiZSBvbWl0dGVkLlxuICAgKi9cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJUb2tlbnMgPSBmdW5jdGlvbiByZW5kZXJUb2tlbnMgKHRva2VucywgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpIHtcbiAgICB2YXIgYnVmZmVyID0gJyc7XG5cbiAgICB2YXIgdG9rZW4sIHN5bWJvbCwgdmFsdWU7XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgIHN5bWJvbCA9IHRva2VuWzBdO1xuXG4gICAgICBpZiAoc3ltYm9sID09PSAnIycpIHZhbHVlID0gdGhpcy5yZW5kZXJTZWN0aW9uKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICdeJykgdmFsdWUgPSB0aGlzLnJlbmRlckludmVydGVkKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICc+JykgdmFsdWUgPSB0aGlzLnJlbmRlclBhcnRpYWwodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJyYnKSB2YWx1ZSA9IHRoaXMudW5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnbmFtZScpIHZhbHVlID0gdGhpcy5lc2NhcGVkVmFsdWUodG9rZW4sIGNvbnRleHQpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAndGV4dCcpIHZhbHVlID0gdGhpcy5yYXdWYWx1ZSh0b2tlbik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclNlY3Rpb24gPSBmdW5jdGlvbiByZW5kZXJTZWN0aW9uICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGJ1ZmZlciA9ICcnO1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcblxuICAgIC8vIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byByZW5kZXIgYW4gYXJiaXRyYXJ5IHRlbXBsYXRlXG4gICAgLy8gaW4gdGhlIGN1cnJlbnQgY29udGV4dCBieSBoaWdoZXItb3JkZXIgc2VjdGlvbnMuXG4gICAgZnVuY3Rpb24gc3ViUmVuZGVyICh0ZW1wbGF0ZSkge1xuICAgICAgcmV0dXJuIHNlbGYucmVuZGVyKHRlbXBsYXRlLCBjb250ZXh0LCBwYXJ0aWFscyk7XG4gICAgfVxuXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuXG4gICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICBmb3IgKHZhciBqID0gMCwgdmFsdWVMZW5ndGggPSB2YWx1ZS5sZW5ndGg7IGogPCB2YWx1ZUxlbmd0aDsgKytqKSB7XG4gICAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlW2pdKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dC5wdXNoKHZhbHVlKSwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3JpZ2luYWxUZW1wbGF0ZSAhPT0gJ3N0cmluZycpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVzZSBoaWdoZXItb3JkZXIgc2VjdGlvbnMgd2l0aG91dCB0aGUgb3JpZ2luYWwgdGVtcGxhdGUnKTtcblxuICAgICAgLy8gRXh0cmFjdCB0aGUgcG9ydGlvbiBvZiB0aGUgb3JpZ2luYWwgdGVtcGxhdGUgdGhhdCB0aGUgc2VjdGlvbiBjb250YWlucy5cbiAgICAgIHZhbHVlID0gdmFsdWUuY2FsbChjb250ZXh0LnZpZXcsIG9yaWdpbmFsVGVtcGxhdGUuc2xpY2UodG9rZW5bM10sIHRva2VuWzVdKSwgc3ViUmVuZGVyKTtcblxuICAgICAgaWYgKHZhbHVlICE9IG51bGwpXG4gICAgICAgIGJ1ZmZlciArPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyICs9IHRoaXMucmVuZGVyVG9rZW5zKHRva2VuWzRdLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJJbnZlcnRlZCA9IGZ1bmN0aW9uIHJlbmRlckludmVydGVkICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBVc2UgSmF2YVNjcmlwdCdzIGRlZmluaXRpb24gb2YgZmFsc3kuIEluY2x1ZGUgZW1wdHkgYXJyYXlzLlxuICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg2XG4gICAgaWYgKCF2YWx1ZSB8fCAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSlcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyUGFydGlhbCA9IGZ1bmN0aW9uIHJlbmRlclBhcnRpYWwgKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscykge1xuICAgIGlmICghcGFydGlhbHMpIHJldHVybjtcblxuICAgIHZhciB2YWx1ZSA9IGlzRnVuY3Rpb24ocGFydGlhbHMpID8gcGFydGlhbHModG9rZW5bMV0pIDogcGFydGlhbHNbdG9rZW5bMV1dO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVG9rZW5zKHRoaXMucGFyc2UodmFsdWUpLCBjb250ZXh0LCBwYXJ0aWFscywgdmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUudW5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiB1bmVzY2FwZWRWYWx1ZSAodG9rZW4sIGNvbnRleHQpIHtcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpXG4gICAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5lc2NhcGVkVmFsdWUgPSBmdW5jdGlvbiBlc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIG11c3RhY2hlLmVzY2FwZSh2YWx1ZSk7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yYXdWYWx1ZSA9IGZ1bmN0aW9uIHJhd1ZhbHVlICh0b2tlbikge1xuICAgIHJldHVybiB0b2tlblsxXTtcbiAgfTtcblxuICBtdXN0YWNoZS5uYW1lID0gJ211c3RhY2hlLmpzJztcbiAgbXVzdGFjaGUudmVyc2lvbiA9ICcyLjEuMyc7XG4gIG11c3RhY2hlLnRhZ3MgPSBbICd7eycsICd9fScgXTtcblxuICAvLyBBbGwgaGlnaC1sZXZlbCBtdXN0YWNoZS4qIGZ1bmN0aW9ucyB1c2UgdGhpcyB3cml0ZXIuXG4gIHZhciBkZWZhdWx0V3JpdGVyID0gbmV3IFdyaXRlcigpO1xuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhlIGRlZmF1bHQgd3JpdGVyLlxuICAgKi9cbiAgbXVzdGFjaGUuY2xlYXJDYWNoZSA9IGZ1bmN0aW9uIGNsZWFyQ2FjaGUgKCkge1xuICAgIHJldHVybiBkZWZhdWx0V3JpdGVyLmNsZWFyQ2FjaGUoKTtcbiAgfTtcblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgdGhlIGdpdmVuIHRlbXBsYXRlIGluIHRoZSBkZWZhdWx0IHdyaXRlciBhbmQgcmV0dXJucyB0aGVcbiAgICogYXJyYXkgb2YgdG9rZW5zIGl0IGNvbnRhaW5zLiBEb2luZyB0aGlzIGFoZWFkIG9mIHRpbWUgYXZvaWRzIHRoZSBuZWVkIHRvXG4gICAqIHBhcnNlIHRlbXBsYXRlcyBvbiB0aGUgZmx5IGFzIHRoZXkgYXJlIHJlbmRlcmVkLlxuICAgKi9cbiAgbXVzdGFjaGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAodGVtcGxhdGUsIHRhZ3MpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5wYXJzZSh0ZW1wbGF0ZSwgdGFncyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIGB0ZW1wbGF0ZWAgd2l0aCB0aGUgZ2l2ZW4gYHZpZXdgIGFuZCBgcGFydGlhbHNgIHVzaW5nIHRoZVxuICAgKiBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlciAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgaWYgKHR5cGVvZiB0ZW1wbGF0ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgdGVtcGxhdGUhIFRlbXBsYXRlIHNob3VsZCBiZSBhIFwic3RyaW5nXCIgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdidXQgXCInICsgdHlwZVN0cih0ZW1wbGF0ZSkgKyAnXCIgd2FzIGdpdmVuIGFzIHRoZSBmaXJzdCAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FyZ3VtZW50IGZvciBtdXN0YWNoZSNyZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKScpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWZhdWx0V3JpdGVyLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuICB9O1xuXG4gIC8vIFRoaXMgaXMgaGVyZSBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCAwLjQueC4sXG4gIC8qZXNsaW50LWRpc2FibGUgKi8gLy8gZXNsaW50IHdhbnRzIGNhbWVsIGNhc2VkIGZ1bmN0aW9uIG5hbWVcbiAgbXVzdGFjaGUudG9faHRtbCA9IGZ1bmN0aW9uIHRvX2h0bWwgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscywgc2VuZCkge1xuICAgIC8qZXNsaW50LWVuYWJsZSovXG5cbiAgICB2YXIgcmVzdWx0ID0gbXVzdGFjaGUucmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyk7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihzZW5kKSkge1xuICAgICAgc2VuZChyZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIGVzY2FwaW5nIGZ1bmN0aW9uIHNvIHRoYXQgdGhlIHVzZXIgbWF5IG92ZXJyaWRlIGl0LlxuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzI0NFxuICBtdXN0YWNoZS5lc2NhcGUgPSBlc2NhcGVIdG1sO1xuXG4gIC8vIEV4cG9ydCB0aGVzZSBtYWlubHkgZm9yIHRlc3RpbmcsIGJ1dCBhbHNvIGZvciBhZHZhbmNlZCB1c2FnZS5cbiAgbXVzdGFjaGUuU2Nhbm5lciA9IFNjYW5uZXI7XG4gIG11c3RhY2hlLkNvbnRleHQgPSBDb250ZXh0O1xuICBtdXN0YWNoZS5Xcml0ZXIgPSBXcml0ZXI7XG5cbn0pKTtcbiIsIi8vIENMSSAtIFZpZXdcbnZhciBDTEkgPSByZXF1aXJlKFwiLi9jbGkuanNcIik7XG52YXIgZGF0YSA9IHJlcXVpcmUoXCIuL2RhdGEuanNcIik7XG52YXIgdGVtcGxhdGUgPSByZXF1aXJlKFwiLi4vdGVtcGxhdGUvbHMuanNcIik7XG5cbnZhciBtdSA9IHJlcXVpcmUoXCJtdXN0YWNoZVwiKTtcblxuLy8gbXUucm9vdCA9IFwiLi4vdGVtcGxhdGVcIlxuXG52YXIgY2xpID0gbmV3IENMSShkYXRhLCBcInJvb3RcIiwgXCJraGFsZWRcIik7XG5cblxuZnVuY3Rpb24gRGlzcGxheShzY3JlZW4pIHtcbiAgICB2YXIgaW5wdXQsIFVQX0tFWSA9IDM4LFxuICAgICAgICBET1dOX0tFWSA9IDQwLFxuICAgICAgICBFTlRFUl9LRVkgPSAxMyxcbiAgICAgICAgS19LRVkgPSA3NSxcbiAgICAgICAgYmFja19rZXkgPSAxMDtcblxuICAgIC8vdG8gdHJhY2sgbG9jYXRpb24gaW4gbGFzdENvbW1hbmQgW10gYnkgdXAvZG93biBhcnJvdyBcbiAgICB0aGlzLndoZXJlID0gY2xpLmxhc3RDb21tYW5kLmxlbmd0aDtcblxuICAgIC8vTWFpbiBFbGVtZW50ICBcbiAgICB0aGlzLnRlcm1pbmFsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLnJlc3VsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5pbnB1dERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5pbnB1dEVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImVtXCIpO1xuICAgIHRoaXMuaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIik7XG4gICAgLy9XaGVuIHVzZXIgZW50ZXIgc29tZXRoaW5nIFxuICAgIHRoaXMuaW5wdXRFbS5pbm5lckhUTUwgPSBjbGkud29ya2luZ0RpcmVjdG9yeSArIFwiICRcIjtcbiAgICB0aGlzLmlucHV0RGl2LmNsYXNzTmFtZSA9IFwiaW5wdXREaXZcIjtcbiAgICB0aGlzLnRlcm1pbmFsLmNsYXNzTmFtZSA9IFwidGVybWluYWxcIjtcbiAgICB0aGlzLnRlcm1pbmFsLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIDEpXG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy9saXN0ZW4gdG8ga2V5c3Ryb2tlcyBpbnNpZGUgdGVybWluYWwgXG4gICAgdGhpcy50ZXJtaW5hbC5vbmtleWRvd24gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHN3aXRjaChlLndoaWNoKXtcbiAgICAgICAgICAgIGNhc2UgRU5URVJfS0VZOlxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsgXG4gICAgICAgICAgICAgICAgYnJlYWs7IFxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzZWxmLmlucHV0LmZvY3VzKCk7XG4gICAgfVxuXG4gICAgLy9jYXB0dXJlIGtleSBzdHJva2VzIGluc2lkZSBpbnB1dFxuICAgIHRoaXMuaW5wdXQub25rZXl1cCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc3dpdGNoIChlLndoaWNoKSB7XG4gICAgICAgICAgICBjYXNlIEVOVEVSX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLmVudGVyKGUpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFVQX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLnVwa2V5KGUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBET1dOX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLmRvd25rZXkoZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIGUuY3RybEtleSAmJiBLX0tFWTpcbiAgICAgICAgICAgICAgICBzZWxmLmNsZWFyKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIEF1dG9tYXRpY2FsbHkgc2Nyb2xsIHRvIHRoZSBib3R0b20gXG4gICAgICAgIC8vIHdpbmRvdy5zY3JvbGxUbygwLCBkb2N1bWVudC5ib2R5Lm9mZnNldEhlaWdodCk7XG4gICAgICAgIHNlbGYudGVybWluYWwuc2Nyb2xsVG9wID0gc2VsZi50ZXJtaW5hbC5zY3JvbGxIZWlnaHQ7XG4gICAgfVxuXG4gICAgLy9BcHBlbmQgdG8gdGhlIGdpdmUgZGl2XG4gICAgdGhpcy50ZXJtaW5hbC5hcHBlbmRDaGlsZCh0aGlzLnJlc3VsdCk7XG4gICAgdGhpcy5pbnB1dERpdi5hcHBlbmRDaGlsZCh0aGlzLmlucHV0RW0pO1xuICAgIHRoaXMuaW5wdXREaXYuYXBwZW5kQ2hpbGQodGhpcy5pbnB1dCk7XG4gICAgdGhpcy50ZXJtaW5hbC5hcHBlbmRDaGlsZCh0aGlzLmlucHV0RGl2KVxuICAgIHNjcmVlbi5hcHBlbmRDaGlsZCh0aGlzLnRlcm1pbmFsKVxuXG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZXN1bHQuaW5uZXJIVE1MID0gXCJcIjtcbiAgICB0aGlzLmlucHV0LnZhbHVlID0gXCJcIjtcbiAgICByZXR1cm47XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmVudGVyID0gZnVuY3Rpb24oZSkge1xuICAgIC8vR1VJIEFmZmVjdCBDb21tYW5kcyBcbiAgICBpZiAodGhpcy5pbnB1dC52YWx1ZSA9PSBcImNsZWFyXCIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB2YXIgdmlldyA9IHRoaXMuZ2V0Vmlldyh0aGlzLmlucHV0LnZhbHVlKTtcblxuICAgIHRoaXMucmVzdWx0Lmluc2VydEFkamFjZW50SFRNTChcImJlZm9yZWVuZFwiLCB2aWV3KVxuXG4gICAgLy9yZXNldFxuICAgIHRoaXMuaW5wdXRFbS5pbm5lckhUTUwgPSBjbGkud29ya2luZ0RpcmVjdG9yeSArIFwiICRcIjtcbiAgICB0aGlzLmlucHV0LnZhbHVlID0gJyc7XG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLnVwa2V5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxldFdoZXJlID0gdGhpcy53aGVyZSAtIDE7XG4gICAgaWYgKGxldFdoZXJlID4gLTEgJiYgbGV0V2hlcmUgPCBjbGkubGFzdENvbW1hbmQubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaW5wdXQudmFsdWUgPSBjbGkubGFzdENvbW1hbmRbLS10aGlzLndoZXJlXTtcbiAgICAgICAgLy9zdGFydCBmcm9tIHRoZSBlbmQgXG4gICAgICAgIHZhciBsZW4gPSB0aGlzLmlucHV0LnZhbHVlLmxlbmd0aDsgXG4gICAgICAgIHRoaXMuaW5wdXQuc2V0U2VsZWN0aW9uUmFuZ2UobGVuLGxlbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmRvd25rZXkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGV0V2hlcmUgPSB0aGlzLndoZXJlICsgMTtcbiAgICBpZiAobGV0V2hlcmUgPiAtMSAmJiBsZXRXaGVyZSA8IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5pbnB1dC52YWx1ZSA9IGNsaS5sYXN0Q29tbWFuZFsrK3RoaXMud2hlcmVdO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhY2hlZCB0aGUgbGltaXQgcmVzZXQgXG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG4gICAgdGhpcy5pbnB1dC52YWx1ZSA9ICcnO1xufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5nZXRWaWV3ID0gZnVuY3Rpb24oY29tbWFuZCkge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZpZXdIZWxwZXIoY2xpLnJ1bihjb21tYW5kKSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFZpZXdIZWxwZXIoZS5tZXNzYWdlKTtcbiAgICB9XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmdldFZpZXdIZWxwZXIgPSBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICB2YXIgb2JqID0ge1xuICAgICAgICB3b3JraW5nRGlyZWN0b3J5OiBjbGkud29ya2luZ0RpcmVjdG9yeSxcbiAgICAgICAgY29tbWFuZDogY2xpLmxhc3RDb21tYW5kW2NsaS5sYXN0Q29tbWFuZC5sZW5ndGggLSAxXSxcbiAgICAgICAgcmVzdWx0OiByZXN1bHRcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc09iamVjdChyZXN1bHQpKSB7XG4gICAgICAgIG9iai5pc0NvbXBhbnkgPSBvYmoucmVzdWx0LmNvbXBhbnkgPyB0cnVlIDogZmFsc2U7XG4gICAgICAgIHJldHVybiBtdS50b19odG1sKHRlbXBsYXRlLnNlY3Rpb24sIG9iaik7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0KSkge1xuICAgICAgICBvYmoucmVzdWx0ID0gb2JqLnJlc3VsdC5qb2luKFwiJm5ic3A7Jm5ic3A7XCIpO1xuICAgICAgICByZXR1cm4gbXUudG9faHRtbCh0ZW1wbGF0ZS5saXN0LCBvYmopO1xuICAgIH1cblxuICAgIHJldHVybiBtdS50b19odG1sKHRlbXBsYXRlLmxpc3QsIG9iaik7XG59XG5cbkRpc3BsYXkucHJvdG90eXBlLmlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgJiYgIUFycmF5LmlzQXJyYXkob2JqKSAmJiBvYmogIT09IG51bGw7XG59XG5cblxuXG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZWxtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5zY3JlZW5cIik7XG5cbiAgICB2YXIgc29tZSA9IG5ldyBEaXNwbGF5KGVsbSk7XG5cbiAgICAvL3doZW4gZmlyc3QgbG9hZGVkIFxuICAgIHNvbWUuaW5wdXQuZm9jdXMoKTtcbn1cbiIsIi8vQ0xJIC0gTW9kZWwgXG5cbmZ1bmN0aW9uIFN0b3JhZ2UoZGF0YSkge1xuICAgIHRoaXMuZGlyZWN0b3J5ID0gZGF0YSB8fCB7fTtcbn1cblxuXG5TdG9yYWdlLnByb3RvdHlwZS5kaXIgPSBmdW5jdGlvbihwd2QsIGRpcmVjdG9yeSkge1xuICAgIHZhciBjdXJyRGlyID0gdGhpcy5kaXJlY3Rvcnk7XG4gICAgdmFyIGRpcmVjdG9yeSA9IGRpcmVjdG9yeSB8fCBmYWxzZTsgXG4gICAgLy9pZiBkaXJlY3RvcnkgaXMgbm90IGdpdmVuIFxuICAgIHZhciBzdWJEaXIgPSBwd2Quc3BsaXQoJy8nKTtcbiAgICBzdWJEaXIuc2hpZnQoKTsgLy9yZW1vdmVzIHRoaXMucm9vdCBcbiAgICBpZiAocHdkID09ICcnIHx8IHB3ZCA9PSB1bmRlZmluZWQgfHwgcHdkID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJEaXI7XG4gICAgfVxuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YkRpci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXRoaXMuaGFzKGN1cnJEaXIsIHN1YkRpcltpXSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiBUaGUgZGlyZWN0b3J5ICdcIiArIHN1YkRpcltpXSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlyZWN0b3J5KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNEaXJlY3RvcnkoY3VyckRpcltzdWJEaXJbaV1dKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiAnXCIgKyBzdWJEaXJbaV0gICtcIicgaXMgbm90IGEgZGlyZWN0b3J5XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjdXJyRGlyID0gY3VyckRpcltzdWJEaXJbaV1dXG4gICAgfVxuICAgIHJldHVybiBjdXJyRGlyO1xufVxuXG5cblN0b3JhZ2UucHJvdG90eXBlLmxpc3QgPSBmdW5jdGlvbihwd2QpIHtcbiAgICB2YXIgbGlzdCA9IFtdO1xuICAgIHZhciBkaXIgPSB0aGlzLmRpcihwd2QpO1xuXG4gICAgZm9yICh2YXIgaSBpbiBkaXIpIHtcbiAgICAgICAgaWYgKGRpci5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICAgICAgaWYgKGkgIT0gXCJkaXJlY3RvcnlcIilcbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goaSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbGlzdDtcbn1cblN0b3JhZ2UucHJvdG90eXBlLmlzRGlyZWN0b3J5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShcImRpcmVjdG9yeVwiKSkge1xuICAgICAgICBpZiAob2JqW1wiZGlyZWN0b3J5XCJdID09IGZhbHNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufVxuU3RvcmFnZS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oZGlyLCBzdWJEaXIpIHtcbiAgICBpZiAoZGlyLmhhc093blByb3BlcnR5KHN1YkRpcikpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZTtcbiIsIi8vIENMSSAtIENvbnRyb2xsZXJcbnZhciBTdG9yYWdlID0gcmVxdWlyZShcIi4vU3RvcmFnZS5qc1wiKTtcblxuLy8gQ0xJIC0gU2ltcGxlIHRoZSBydW5uZXIgQ29udHJvbGxlciBcbmZ1bmN0aW9uIENMSShkYXRhLCByb290LCBvd25lcikge1xuICAgIC8vdXNlciBpbmZvIFxuICAgIHRoaXMub3duZXIgPSBvd25lcjtcbiAgICB0aGlzLnJvb3QgID0gcm9vdCB8fCBcInJvb3RcIjtcbiAgICAvL3B3ZCBcbiAgICB0aGlzLndvcmtpbmdEaXJlY3RvcnkgPSBvd25lciB8fCB0aGlzLnJvb3QgO1xuICAgIC8vY29tbWFuZHMgc3RvcmFnZVxuICAgIHRoaXMubGFzdENvbW1hbmQgPSBbXTtcbiAgICB0aGlzLmNvbW1hbmRzID0gW1wibHNcIiwgXCJoZWxwXCIsIFwiP1wiLCBcImNkXCIsIFwiY2F0XCIsIFwicHdkXCIsIFwib3BlblwiXTtcbiAgICAvL3RoZSBkYXRhIG9iamVjdCBcbiAgICB0aGlzLmRhdGEgPSBuZXcgU3RvcmFnZShkYXRhKTtcbn1cblxuLy9DTEkgLSBCZWdpbiBQcm90b3R5cGUgXG5DTEkucHJvdG90eXBlLnNldFB3ZCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHRoaXMud29ya2luZ0RpcmVjdG9yeSA9IHRoaXMuY2xlYW5Qd2QocHdkKTtcbn1cblxuQ0xJLnByb3RvdHlwZS5jbGVhblB3ZCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHZhciBsaXN0RGlyZWN0b3J5ID0gcHdkLnNwbGl0KC9bXFxzfFxcL10vKTsgLy8gLiB8IHNwYWNlIHwgc2xhc2ggIFxuICAgIGZvciAodmFyIGkgPSBsaXN0RGlyZWN0b3J5Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChsaXN0RGlyZWN0b3J5W2ldLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGlzdERpcmVjdG9yeS5zcGxpY2UoaSwgMSlcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy9jbGVhbiBwd2QgZnJvbSBzcGFjZXMvc2xhc2hlcyBhdCB0aGUgZW5kIG9mIHRoZSBsaW5rKHB3ZClcbiAgICByZXR1cm4gbGlzdERpcmVjdG9yeS5qb2luKCcvJyk7XG59LFxuQ0xJLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgYXJnID0gaW5wdXQuc3BsaXQoL1xccysvKTsgLy9yZW1vdmluZyB1bm5lY2Vzc2FyeSBzcGFjZXMgXG4gICAgdmFyIGNvbW1hbmQgPSBhcmdbMF0udG9Mb3dlckNhc2UoKTsgLy9cbiAgICB2YXIgcHdkID0gYXJnWzFdID8gdGhpcy5jbGVhblB3ZChhcmdbMV0pIDogdGhpcy53b3JraW5nRGlyZWN0b3J5O1xuXG4gICAgdGhpcy5sYXN0Q29tbWFuZC5wdXNoKGlucHV0KTsgXG5cbiAgICBpZiAodGhpcy5jb21tYW5kcy5pbmRleE9mKGNvbW1hbmQpID09IC0xKSB7XG4gICAgICAgIHRocm93IEVycm9yKFwiVW5rbm93biBjb21tYW5kICdcIiArIGNvbW1hbmQgKyBcIidcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm9wdGlvbihjb21tYW5kLCBwd2QpXG59LFxuQ0xJLnByb3RvdHlwZS5vcHRpb24gPSBmdW5jdGlvbihjb21tYW5kLCBwd2QpIHtcbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnbHMnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubHMocHdkKTtcbiAgICAgICAgY2FzZSAnPyc6XG4gICAgICAgIGNhc2UgJ2hlbHAnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGVscChwd2QpO1xuICAgICAgICBjYXNlICdjZCc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jZChwd2QpO1xuICAgICAgICBjYXNlICdjYXQnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2F0KHB3ZCk7XG4gICAgICAgIGNhc2UgJ29wZW4nOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3Blbihwd2QpO1xuICAgICAgICBjYXNlICdwd2QnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHdkKHB3ZClcbiAgICB9XG5cbn1cbkNMSS5wcm90b3R5cGUubHMgPSBmdW5jdGlvbihwd2QpIHtcbiAgICBpZihwd2QgIT09IHRoaXMud29ya2luZ0RpcmVjdG9yeSlcbiAgICAgICAgcHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuXG4gICAgZmlsZSA9IHRoaXMuZGF0YS5kaXIocHdkKTtcblxuICAgIGlmICghdGhpcy5kYXRhLmlzRGlyZWN0b3J5KGZpbGUpKSB7XG4gICAgICAgIHJldHVybiBwd2Quc3BsaXQoJy8nKVsxXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5kYXRhLmxpc3QocHdkKTtcbn1cbkNMSS5wcm90b3R5cGUuaGVscCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHJldHVybiAoXCIgICA8cHJlPiBXZWxjb21lIHRvIFwiK3RoaXMub3duZXIrXCIncyBzZXJ2ZXIgdmlhIHRoZSB0ZXJtaW5hbFxcblwiK1xuICAgICAgICAgICAgXCIgICA/LCBoZWxwIDogc2hvd3Mgc29tZSBoZWxwZnVsIGNvbW1hbmRzLlxcblwiICtcbiAgICAgICAgICAgIFwiICAgICAgICBjZCA6IGNoYW5nZSBkaXJlY3RvcnkuXFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgIGxzIDogbGlzdCBkaXJlY3RvcnkgY29udGVudHMgXFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgcHdkIDogb3V0cHV0IHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgY2F0IDogcHJpbnQgdGhlIGZpbGUg8J+YiS5cXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgICAgdmkgOiBjb21pbmcgb3V0IHNvb25cXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgY2xlYXIgOiBjbGVhcnMgdGhlIGNvbnNvbGUuIHRyeSBcXCdjdHJsK2tcXCdcIitcbiAgICAgICAgICAgIFwiICAgPC9wcmU+XCIpXG4gICAgLy8gcmV0dXJuIFwiJm5ic3A7Jm5ic3A7Y2Q6ICA8L2JyPiAmbmJzcDsmbmJzcDtsczogIDxicj4gJm5ic3A7Jm5ic3A7IDwvYnI+ICZuYnNwOyZuYnNwO2NhdDogcmVhZCBhIGZpbGUgPC9icj4gJm5ic3A7Jm5ic3A7XCI7XG59XG5DTEkucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbihwd2QpIHtcbiAgICB2YXIgcHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuICAgIHZhciBkaXIgPSB0aGlzLmRhdGEuZGlyKHB3ZCk7XG4gICAgaWYodGhpcy5kYXRhLmlzRGlyZWN0b3J5KGRpcikpe1xuICAgICAgICB0aHJvdyBFcnJvcihcInNvcnJ5IHRoZXJlIGlzIG5vIHN1cHBvcnQgdG8gJ29wZW4nIGRpcmVjdG9yaWVzIHlldCA6KFwiKVxuICAgIH1cbiAgICBpZihkaXIudXJsID09IHVuZGVmaW5lZCB8fCBkaXIudXJsID09IG51bGwpe1xuICAgICAgICB0aHJvdyBFcnJvcihcIm5vIFVSTCBpcyBzcGVjaWZ5IHRvIGJlIG9wZW4hXCIpXG4gICAgfVxuICAgIHdpbmRvdy5vcGVuKGRpci51cmwpXG4gICAgcmV0dXJuIGRpci51cmw7XG59XG5cbkNMSS5wcm90b3R5cGUuY2F0ID0gZnVuY3Rpb24ocHdkKSB7XG5cdHZhciBmdWxsUHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuXG4gICAgdmFyIGZpbGUgPSB0aGlzLmRhdGEuZGlyKGZ1bGxQd2QpOyBcbiAgICBpZiAodGhpcy5kYXRhLmlzRGlyZWN0b3J5KGZpbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhdDogJ1wiICsgcHdkICArXCInIGlzIGEgZGlyZWN0b3J5XCIpXG4gICAgfVxuICAgIHJldHVybiBmaWxlO1xufVxuXG5DTEkucHJvdG90eXBlLnB3ZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIi9cIit0aGlzLndvcmtpbmdEaXJlY3Rvcnk7XG59XG5DTEkucHJvdG90eXBlLmNkID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgaWYgKHB3ZCA9PSBcIi4uXCIpIHtcbiAgICAgICAgdmFyIGFycmF5RGlyZWN0b3J5ID0gdGhpcy53b3JraW5nRGlyZWN0b3J5LnNwbGl0KCcvJyk7XG4gICAgICAgIGlmKGFycmF5RGlyZWN0b3J5Lmxlbmd0aCA+IDEpe1xuICAgICAgICAgICAgYXJyYXlEaXJlY3RvcnkucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcHdkID0gYXJyYXlEaXJlY3Rvcnkuam9pbignLycpXG4gICAgICAgIHRoaXMud29ya2luZ0RpcmVjdG9yeSA9IHB3ZDtcbiAgICB9IGVsc2Uge1xuXHQgICAgdmFyIHB3ZCA9IHRoaXMuY2xlYW5Qd2QodGhpcy53b3JraW5nRGlyZWN0b3J5ICsgJy8nICsgcHdkKTtcbiAgICAgICAgLy9jaGVjayBpZiB0aGUgcHdkIGlzIGEgZGlyZWN0b3J5IFxuICAgICAgICB0aGlzLmRhdGEuZGlyKHB3ZCwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy53b3JraW5nRGlyZWN0b3J5ID0gcHdkOyBcbiAgICB9XG5cbiAgICB0aGlzLnNldFB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkpO1xuXG4gICAgcmV0dXJuICcnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENMSTsgXG4iLCIvL0V4cGVyaWVuY2UgXG52YXIgVEZBID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiVGVhY2ggRm9yIEFtZXJpY2FcIixcbiAgICBcInN1YkhlYWRlclwiOiBcIkZyb250LUVuZCBEZXZlbG9wZXJcIixcbiAgICBcImRldGFpbFwiOiBbXCJMb3Qgb2YgSmF2YVNyaXB0LCBIVE1MLCAmIENTU1wiXSxcbiAgICBcImxvY2F0aW9uXCI6IFwiTllDLCBOZXcgWW9ya1wiLFxuICAgIFwicGVyaW9kXCI6IFwiQXVndXN0LURlY2VtYmVyIGAxNFwiLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly93d3cudGVhY2hmb3JhbWVyaWNhLm9yZy9cIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG52YXIgQUJDID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQUJDIEdsb2JhbCBTeXN0ZW1cIixcbiAgICBcInN1YkhlYWRlclwiOiBcIlNvZnR3YXJlIERldmVsb3BlclwiLFxuICAgIFwiZGV0YWlsXCI6IFtcIvCfk4kgQ3JlYXRlIHNvZnR3YXJlIHRvIG1hbmlwdWxhdGUgYW5kIGV4dHJhY3QgZGF0YSB1c2luZyBSZWdleCBFeHByZXNzaW9uIHdpdGggSmF2YSBvbiBVTklYIHN5c3RlbSBcIixcbiAgICAgICAgXCLwn5K7IERldmVsb3BlZCB3ZWIgYXBwbGljYXRpb25zIHVzaW5nIEhUTUwvWEhUTUwsIENTUyBhbmQgSmF2YVNjcmlwdCB3aXRoIFBIUCAmYW1wOyBNeVNRTCBcIixcbiAgICAgICAgXCLwn5OwIENyZWF0ZSBhbmQgbWFuYWdlIENNUyB1c2luZyBXb3JkUHJlc3MgdG8gZW5zdXJlIHNlY3VyaXR5IGFuZCBlZmZpY2llbmN5IGZvciB0aGUgRW5kLVVzZXJzXCJcbiAgICBdLFxuICAgIFwicGVyaW9kXCI6IFwiSmFudWFyeS1BdWd1c3QgJzE0XCIsXG4gICAgXCJsb2NhdGlvblwiOiBcIk5ZQywgTmV3IFlvcmtcIixcbiAgICBcInVybFwiOiBcInd3dy5hYmNnbG9iYWxzeXN0ZW1zLmNvbS9cIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG4vL0JpbmFyeUhlYXBcbnZhciBCaW5hcnlIZWFwID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQmluYXJ5SGVhcFwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiT3Blbi1Tb3VyY2VcIixcbiAgICBcImRldGFpbFwiOiBcIkJpbmFyeUhlYXAgSW1wbGVtZW50YXRpb24gYXMgQmluYXJ5VHJlZS1saWtlIHN0cnVjdHVyZVwiLFxuICAgIFwibG9jYXRpb25cIjogXCJBZGVuLCBZZW1lblwiLFxuICAgIFwicGVyaW9kXCI6IFwiU2VwdGVtYmVyXCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vS2hhbGVkTW9oYW1lZFAvQmluYXJ5SGVhcFwiLFxuICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlLFxufVxuXG52YXIgSHVmZm1hbmRDb2RpbmcgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJIdWZmbWFuQ29kaW5nXCIsXG4gICAgXCJzdWJIZWFkZXJcIjogXCJPcGVuLVNvdXJjZVwiLFxuICAgIFwiZGV0YWlsXCI6IFwiSHVmZm1hbmRDb2RpbmcgdXNpbmcgSlMsIEhUTUwsIENTUyBDT09MIGh1aFwiLFxuICAgIFwibG9jYXRpb25cIjogXCJBZGVuLCBZZW1lblwiLFxuICAgIFwicGVyaW9kXCI6IFwiSnVuZVwiLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9raGFsZWRtLmNvbS9odWZmbWFuXCIsXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn1cblxuLy9za2lsbHNcbnZhciBza2lsbHMgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJTa2lsbHNcIixcbiAgICBcInN1YkhlYWRlclwiOiBcIvCflKcgVG9vbHMgSSd2ZSB1c2VkXCIsXG4gICAgXCJwZXJpb2RcIjogXCIyMDA2LVwiICsgbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpLnRvU3RyaW5nKCksXG4gICAgXCJkZXRhaWxcIjogW1xuICAgICAgICBcIuKckyBMYW5ndWFnZXM6IEphdmFTY3JpcHQsICBDKyssIEphdmEgLCAmIE90aGVyc1wiLFxuICAgICAgICBcIuKckyBKUyBGcmFtZXdvcms6IEpRdWVyeSwgQW5ndWxhckpTLCBCYWNrYm9uZS5qcywgJiBEM0pTXCIsXG4gICAgICAgIFwi4pyTIE9wZW4tU291cmNlOiBXb3JkUHJlc3MsIHZCdWxsdGluLCAmIFhlbkZvcm8gXCJcbiAgICBdLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL0toYWxlZE1vaGFtZWRQXCIsXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn07XG5cbnZhciBjZXJ0aWZpY2F0aW9uID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQ2VydGlmaWNhdGlvblwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiTGlzdCBvZiBjZXJ0aWZpY2F0aW9uIChJVClcIixcbiAgICBcImRldGFpbFwiOiBbXG4gICAgICAgIFwi4pyTIENvbXBUSUEgQSsgLCBDb21wVElBIExpY2Vuc2UgTUhHQ0hQQlJMRjFRUVBGXCIsXG4gICAgICAgIFwi4pyTIE1pY3Jvc29mdCBDZXJ0aWZpZWQgUHJvZmVzc2lvbmFsLCBNaWNyb3NvZnQgTGljZW5zZSBFNzg1wq01NDc5XCIsXG4gICAgICAgIFwi4pyTIFNlcnZlciBWaXJ0dWFsaXphdGlvbiB3aXRoIFdpbmRvd3MgU2VydmVyIEh5cGVywq1WIGFuZCBTeXN0ZW0gQ2VudGVyLCBNaWNyb3NvZnRcIlxuICAgIF0sXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn1cblxuLy9lZHVjYXRpb24gXG52YXIgZWR1Y2F0aW9uID0ge1xuICAgICAgICBcImhlYWRlclwiOiBcIkJyb29rbHluIENvbGxlZ2VcIixcbiAgICAgICAgXCJzdWJIZWFkZXJcIjogXCLwn46TIENvbXB1dGVyIFNjaWVuY2VcIixcbiAgICAgICAgXCJwZXJpb2RcIjogXCIyMDEwLTIwMTRcIixcbiAgICAgICAgXCJkZXRhaWxcIjogW1xuICAgICAgICAgICAgXCJEZWFuIGxpc3QgJzEzICcxNFwiLFxuICAgICAgICAgICAgXCJDUyBNZW50b3Igd2l0aCB0aGUgRGVwYXJ0bWVudCBvZiBDb21wdXRlciBTY2llbmNlXCIsXG4gICAgICAgIF0sXG4gICAgICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlXG4gICAgfVxuICAgIC8vRmlsZSBzdHJ1Y3R1cmVcbnZhciBkaXJlY3RvcnkgPSB7XG4gICAgXCJleHBlcmllbmNlXCI6IHtcbiAgICAgICAgXCJURkFcIjogVEZBLFxuICAgICAgICBcIkFCQ1wiOiBBQkMsXG4gICAgfSxcbiAgICBcInByb2plY3RzXCI6IHtcbiAgICAgICAgXCJCaW5hcnlIZWFwXCI6IEJpbmFyeUhlYXAsXG4gICAgICAgIFwiSHVmZm1hbmRDb2RpbmdcIjogSHVmZm1hbmRDb2RpbmcsXG4gICAgfSxcbiAgICBcIm90aGVyc1wiOiB7XG4gICAgICAgIFwiZWR1Y2F0aW9uXCI6IGVkdWNhdGlvbixcbiAgICAgICAgXCJza2lsbHNcIjogc2tpbGxzLFxuICAgICAgICBcImNlcnRpZmljYXRpb25cIjogY2VydGlmaWNhdGlvblxuICAgIH1cblxufVxubW9kdWxlLmV4cG9ydHMgPSBkaXJlY3Rvcnk7XG4iLCJ2YXIgc2VjdGlvbiA9IFtcIjxkaXY+XCIsXG5cdFx0XHRcdFx0XCI8ZW0+e3t3b3JraW5nRGlyZWN0b3J5fX0gJCB7e2NvbW1hbmR9fTwvZW0+XCIsXG5cdFx0XHRcdFwiPC9kaXY+XCIsXG5cdFx0XHRcdFwiPGRpdiBjbGFzcz1cXFwic2VjdGlvblxcXCI+XCIsXG5cdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJoZWFkZXJcXFwiPlwiLFxuXHRcdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJ0aXRsZVxcXCI+XCIsXG5cdFx0XHRcdFx0XHRcdFwiPGI+e3tyZXN1bHQuaGVhZGVyfX08L2I+XCIsXG5cdFx0XHRcdFx0XHRcdFwiPC9icj5cIixcblx0XHRcdFx0XHRcdFx0XCI8ZW0+fiB7e3Jlc3VsdC5zdWJIZWFkZXJ9fTwvZW0+XCIsIFxuXHRcdFx0XHRcdFx0XCI8L2Rpdj5cIixcblx0XHRcdFx0XHRcdFwiPGIgY2xhc3M9XFxcInBlcmlvZFxcXCI+ICB7e3Jlc3VsdC5sb2NhdGlvbn19ICA8L2JyPiB7e3Jlc3VsdC5wZXJpb2R9fTwvYj5cIixcblx0XHRcdFx0XHRcIjwvZGl2PlwiLFxuXHRcdFx0XHRcdFwiPGRpdiBjbGFzcz1cXFwiY2xlYXJmaXhcXFwiPjwvZGl2PiBcIixcblx0XHRcdFx0XHRcIjxocj4gXCIsXG5cdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJkZXRhaWxzXFxcIj4gXCIsXG5cdFx0XHRcdFx0XHRcIjx1bD57eyNyZXN1bHQuZGV0YWlsfX0gPGxpPnt7Ln19PC9saT57ey9yZXN1bHQuZGV0YWlsfX08L3VsPlwiLFxuXHRcdFx0XHRcdFwiPC9kaXY+XCIsXG5cdFx0XHRcdFwiPC9kaXY+XCJdLmpvaW4oXCJcXG5cIik7XG5cbnZhciBsaXN0ID0gW1wiPGRpdiBjbGFzcz1cXFwibGlzdFxcXCI+IFwiLFxuXHQgICAgXHRcdFwiPGVtPnt7d29ya2luZ0RpcmVjdG9yeX19ICQge3tjb21tYW5kfX08L2VtPlwiLCBcblx0ICAgIFx0XHRcIjxwPnt7JnJlc3VsdH19PC9wPlwiLFxuICAgIFx0XHRcIjwvZGl2PlwiXS5qb2luKFwiXFxuXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzZWN0aW9uOiBzZWN0aW9uLFxuICAgIGxpc3Q6IGxpc3Rcbn0iXX0=
