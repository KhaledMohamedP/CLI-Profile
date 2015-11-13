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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXVzdGFjaGUvbXVzdGFjaGUuanMiLCJzcmMvanMvRGlzcGxheS5qcyIsInNyYy9qcy9TdG9yYWdlLmpzIiwic3JjL2pzL2NsaS5qcyIsInNyYy9qcy9kYXRhLmpzIiwic3JjL3RlbXBsYXRlL2xzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbm5CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIVxuICogbXVzdGFjaGUuanMgLSBMb2dpYy1sZXNzIHt7bXVzdGFjaGV9fSB0ZW1wbGF0ZXMgd2l0aCBKYXZhU2NyaXB0XG4gKiBodHRwOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzXG4gKi9cblxuLypnbG9iYWwgZGVmaW5lOiBmYWxzZSBNdXN0YWNoZTogdHJ1ZSovXG5cbihmdW5jdGlvbiBkZWZpbmVNdXN0YWNoZSAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgZXhwb3J0cyAmJiB0eXBlb2YgZXhwb3J0cy5ub2RlTmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICBmYWN0b3J5KGV4cG9ydHMpOyAvLyBDb21tb25KU1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbJ2V4cG9ydHMnXSwgZmFjdG9yeSk7IC8vIEFNRFxuICB9IGVsc2Uge1xuICAgIGdsb2JhbC5NdXN0YWNoZSA9IHt9O1xuICAgIGZhY3RvcnkoTXVzdGFjaGUpOyAvLyBzY3JpcHQsIHdzaCwgYXNwXG4gIH1cbn0odGhpcywgZnVuY3Rpb24gbXVzdGFjaGVGYWN0b3J5IChtdXN0YWNoZSkge1xuXG4gIHZhciBvYmplY3RUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiBpc0FycmF5UG9seWZpbGwgKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3RUb1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgZnVuY3Rpb24gaXNGdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmplY3QgPT09ICdmdW5jdGlvbic7XG4gIH1cblxuICAvKipcbiAgICogTW9yZSBjb3JyZWN0IHR5cGVvZiBzdHJpbmcgaGFuZGxpbmcgYXJyYXlcbiAgICogd2hpY2ggbm9ybWFsbHkgcmV0dXJucyB0eXBlb2YgJ29iamVjdCdcbiAgICovXG4gIGZ1bmN0aW9uIHR5cGVTdHIgKG9iaikge1xuICAgIHJldHVybiBpc0FycmF5KG9iaikgPyAnYXJyYXknIDogdHlwZW9mIG9iajtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cCAoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bXFwtXFxbXFxde30oKSorPy4sXFxcXFxcXiR8I1xcc10vZywgJ1xcXFwkJicpO1xuICB9XG5cbiAgLyoqXG4gICAqIE51bGwgc2FmZSB3YXkgb2YgY2hlY2tpbmcgd2hldGhlciBvciBub3QgYW4gb2JqZWN0LFxuICAgKiBpbmNsdWRpbmcgaXRzIHByb3RvdHlwZSwgaGFzIGEgZ2l2ZW4gcHJvcGVydHlcbiAgICovXG4gIGZ1bmN0aW9uIGhhc1Byb3BlcnR5IChvYmosIHByb3BOYW1lKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIChwcm9wTmFtZSBpbiBvYmopO1xuICB9XG5cbiAgLy8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9pc3N1ZXMuYXBhY2hlLm9yZy9qaXJhL2Jyb3dzZS9DT1VDSERCLTU3N1xuICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4OVxuICB2YXIgcmVnRXhwVGVzdCA9IFJlZ0V4cC5wcm90b3R5cGUudGVzdDtcbiAgZnVuY3Rpb24gdGVzdFJlZ0V4cCAocmUsIHN0cmluZykge1xuICAgIHJldHVybiByZWdFeHBUZXN0LmNhbGwocmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgbm9uU3BhY2VSZSA9IC9cXFMvO1xuICBmdW5jdGlvbiBpc1doaXRlc3BhY2UgKHN0cmluZykge1xuICAgIHJldHVybiAhdGVzdFJlZ0V4cChub25TcGFjZVJlLCBzdHJpbmcpO1xuICB9XG5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICAnJic6ICcmYW1wOycsXG4gICAgJzwnOiAnJmx0OycsXG4gICAgJz4nOiAnJmd0OycsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmIzM5OycsXG4gICAgJy8nOiAnJiN4MkY7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwgKHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInXFwvXS9nLCBmdW5jdGlvbiBmcm9tRW50aXR5TWFwIChzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgdmFyIHdoaXRlUmUgPSAvXFxzKi87XG4gIHZhciBzcGFjZVJlID0gL1xccysvO1xuICB2YXIgZXF1YWxzUmUgPSAvXFxzKj0vO1xuICB2YXIgY3VybHlSZSA9IC9cXHMqXFx9LztcbiAgdmFyIHRhZ1JlID0gLyN8XFxefFxcL3w+fFxce3wmfD18IS87XG5cbiAgLyoqXG4gICAqIEJyZWFrcyB1cCB0aGUgZ2l2ZW4gYHRlbXBsYXRlYCBzdHJpbmcgaW50byBhIHRyZWUgb2YgdG9rZW5zLiBJZiB0aGUgYHRhZ3NgXG4gICAqIGFyZ3VtZW50IGlzIGdpdmVuIGhlcmUgaXQgbXVzdCBiZSBhbiBhcnJheSB3aXRoIHR3byBzdHJpbmcgdmFsdWVzOiB0aGVcbiAgICogb3BlbmluZyBhbmQgY2xvc2luZyB0YWdzIHVzZWQgaW4gdGhlIHRlbXBsYXRlIChlLmcuIFsgXCI8JVwiLCBcIiU+XCIgXSkuIE9mXG4gICAqIGNvdXJzZSwgdGhlIGRlZmF1bHQgaXMgdG8gdXNlIG11c3RhY2hlcyAoaS5lLiBtdXN0YWNoZS50YWdzKS5cbiAgICpcbiAgICogQSB0b2tlbiBpcyBhbiBhcnJheSB3aXRoIGF0IGxlYXN0IDQgZWxlbWVudHMuIFRoZSBmaXJzdCBlbGVtZW50IGlzIHRoZVxuICAgKiBtdXN0YWNoZSBzeW1ib2wgdGhhdCB3YXMgdXNlZCBpbnNpZGUgdGhlIHRhZywgZS5nLiBcIiNcIiBvciBcIiZcIi4gSWYgdGhlIHRhZ1xuICAgKiBkaWQgbm90IGNvbnRhaW4gYSBzeW1ib2wgKGkuZS4ge3tteVZhbHVlfX0pIHRoaXMgZWxlbWVudCBpcyBcIm5hbWVcIi4gRm9yXG4gICAqIGFsbCB0ZXh0IHRoYXQgYXBwZWFycyBvdXRzaWRlIGEgc3ltYm9sIHRoaXMgZWxlbWVudCBpcyBcInRleHRcIi5cbiAgICpcbiAgICogVGhlIHNlY29uZCBlbGVtZW50IG9mIGEgdG9rZW4gaXMgaXRzIFwidmFsdWVcIi4gRm9yIG11c3RhY2hlIHRhZ3MgdGhpcyBpc1xuICAgKiB3aGF0ZXZlciBlbHNlIHdhcyBpbnNpZGUgdGhlIHRhZyBiZXNpZGVzIHRoZSBvcGVuaW5nIHN5bWJvbC4gRm9yIHRleHQgdG9rZW5zXG4gICAqIHRoaXMgaXMgdGhlIHRleHQgaXRzZWxmLlxuICAgKlxuICAgKiBUaGUgdGhpcmQgYW5kIGZvdXJ0aCBlbGVtZW50cyBvZiB0aGUgdG9rZW4gYXJlIHRoZSBzdGFydCBhbmQgZW5kIGluZGljZXMsXG4gICAqIHJlc3BlY3RpdmVseSwgb2YgdGhlIHRva2VuIGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVG9rZW5zIHRoYXQgYXJlIHRoZSByb290IG5vZGUgb2YgYSBzdWJ0cmVlIGNvbnRhaW4gdHdvIG1vcmUgZWxlbWVudHM6IDEpIGFuXG4gICAqIGFycmF5IG9mIHRva2VucyBpbiB0aGUgc3VidHJlZSBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSBhdFxuICAgKiB3aGljaCB0aGUgY2xvc2luZyB0YWcgZm9yIHRoYXQgc2VjdGlvbiBiZWdpbnMuXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlICh0ZW1wbGF0ZSwgdGFncykge1xuICAgIGlmICghdGVtcGxhdGUpXG4gICAgICByZXR1cm4gW107XG5cbiAgICB2YXIgc2VjdGlvbnMgPSBbXTsgICAgIC8vIFN0YWNrIHRvIGhvbGQgc2VjdGlvbiB0b2tlbnNcbiAgICB2YXIgdG9rZW5zID0gW107ICAgICAgIC8vIEJ1ZmZlciB0byBob2xkIHRoZSB0b2tlbnNcbiAgICB2YXIgc3BhY2VzID0gW107ICAgICAgIC8vIEluZGljZXMgb2Ygd2hpdGVzcGFjZSB0b2tlbnMgb24gdGhlIGN1cnJlbnQgbGluZVxuICAgIHZhciBoYXNUYWcgPSBmYWxzZTsgICAgLy8gSXMgdGhlcmUgYSB7e3RhZ319IG9uIHRoZSBjdXJyZW50IGxpbmU/XG4gICAgdmFyIG5vblNwYWNlID0gZmFsc2U7ICAvLyBJcyB0aGVyZSBhIG5vbi1zcGFjZSBjaGFyIG9uIHRoZSBjdXJyZW50IGxpbmU/XG5cbiAgICAvLyBTdHJpcHMgYWxsIHdoaXRlc3BhY2UgdG9rZW5zIGFycmF5IGZvciB0aGUgY3VycmVudCBsaW5lXG4gICAgLy8gaWYgdGhlcmUgd2FzIGEge3sjdGFnfX0gb24gaXQgYW5kIG90aGVyd2lzZSBvbmx5IHNwYWNlLlxuICAgIGZ1bmN0aW9uIHN0cmlwU3BhY2UgKCkge1xuICAgICAgaWYgKGhhc1RhZyAmJiAhbm9uU3BhY2UpIHtcbiAgICAgICAgd2hpbGUgKHNwYWNlcy5sZW5ndGgpXG4gICAgICAgICAgZGVsZXRlIHRva2Vuc1tzcGFjZXMucG9wKCldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BhY2VzID0gW107XG4gICAgICB9XG5cbiAgICAgIGhhc1RhZyA9IGZhbHNlO1xuICAgICAgbm9uU3BhY2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgb3BlbmluZ1RhZ1JlLCBjbG9zaW5nVGFnUmUsIGNsb3NpbmdDdXJseVJlO1xuICAgIGZ1bmN0aW9uIGNvbXBpbGVUYWdzICh0YWdzVG9Db21waWxlKSB7XG4gICAgICBpZiAodHlwZW9mIHRhZ3NUb0NvbXBpbGUgPT09ICdzdHJpbmcnKVxuICAgICAgICB0YWdzVG9Db21waWxlID0gdGFnc1RvQ29tcGlsZS5zcGxpdChzcGFjZVJlLCAyKTtcblxuICAgICAgaWYgKCFpc0FycmF5KHRhZ3NUb0NvbXBpbGUpIHx8IHRhZ3NUb0NvbXBpbGUubGVuZ3RoICE9PSAyKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdGFnczogJyArIHRhZ3NUb0NvbXBpbGUpO1xuXG4gICAgICBvcGVuaW5nVGFnUmUgPSBuZXcgUmVnRXhwKGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzBdKSArICdcXFxccyonKTtcbiAgICAgIGNsb3NpbmdUYWdSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAodGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgICAgY2xvc2luZ0N1cmx5UmUgPSBuZXcgUmVnRXhwKCdcXFxccyonICsgZXNjYXBlUmVnRXhwKCd9JyArIHRhZ3NUb0NvbXBpbGVbMV0pKTtcbiAgICB9XG5cbiAgICBjb21waWxlVGFncyh0YWdzIHx8IG11c3RhY2hlLnRhZ3MpO1xuXG4gICAgdmFyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0ZW1wbGF0ZSk7XG5cbiAgICB2YXIgc3RhcnQsIHR5cGUsIHZhbHVlLCBjaHIsIHRva2VuLCBvcGVuU2VjdGlvbjtcbiAgICB3aGlsZSAoIXNjYW5uZXIuZW9zKCkpIHtcbiAgICAgIHN0YXJ0ID0gc2Nhbm5lci5wb3M7XG5cbiAgICAgIC8vIE1hdGNoIGFueSB0ZXh0IGJldHdlZW4gdGFncy5cbiAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwob3BlbmluZ1RhZ1JlKTtcblxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCB2YWx1ZUxlbmd0aCA9IHZhbHVlLmxlbmd0aDsgaSA8IHZhbHVlTGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjaHIgPSB2YWx1ZS5jaGFyQXQoaSk7XG5cbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGNocikpIHtcbiAgICAgICAgICAgIHNwYWNlcy5wdXNoKHRva2Vucy5sZW5ndGgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdG9rZW5zLnB1c2goWyAndGV4dCcsIGNociwgc3RhcnQsIHN0YXJ0ICsgMSBdKTtcbiAgICAgICAgICBzdGFydCArPSAxO1xuXG4gICAgICAgICAgLy8gQ2hlY2sgZm9yIHdoaXRlc3BhY2Ugb24gdGhlIGN1cnJlbnQgbGluZS5cbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxuJylcbiAgICAgICAgICAgIHN0cmlwU3BhY2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgb3BlbmluZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihvcGVuaW5nVGFnUmUpKVxuICAgICAgICBicmVhaztcblxuICAgICAgaGFzVGFnID0gdHJ1ZTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdHlwZS5cbiAgICAgIHR5cGUgPSBzY2FubmVyLnNjYW4odGFnUmUpIHx8ICduYW1lJztcbiAgICAgIHNjYW5uZXIuc2Nhbih3aGl0ZVJlKTtcblxuICAgICAgLy8gR2V0IHRoZSB0YWcgdmFsdWUuXG4gICAgICBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW4oZXF1YWxzUmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAneycpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nQ3VybHlSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihjdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgICAgdHlwZSA9ICcmJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gc2Nhbm5lci5zY2FuVW50aWwoY2xvc2luZ1RhZ1JlKTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggdGhlIGNsb3NpbmcgdGFnLlxuICAgICAgaWYgKCFzY2FubmVyLnNjYW4oY2xvc2luZ1RhZ1JlKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCB0YWcgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgICAgdG9rZW4gPSBbIHR5cGUsIHZhbHVlLCBzdGFydCwgc2Nhbm5lci5wb3MgXTtcbiAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgaWYgKHR5cGUgPT09ICcjJyB8fCB0eXBlID09PSAnXicpIHtcbiAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcvJykge1xuICAgICAgICAvLyBDaGVjayBzZWN0aW9uIG5lc3RpbmcuXG4gICAgICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICAgICAgaWYgKCFvcGVuU2VjdGlvbilcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vub3BlbmVkIHNlY3Rpb24gXCInICsgdmFsdWUgKyAnXCIgYXQgJyArIHN0YXJ0KTtcblxuICAgICAgICBpZiAob3BlblNlY3Rpb25bMV0gIT09IHZhbHVlKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5jbG9zZWQgc2VjdGlvbiBcIicgKyBvcGVuU2VjdGlvblsxXSArICdcIiBhdCAnICsgc3RhcnQpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnbmFtZScgfHwgdHlwZSA9PT0gJ3snIHx8IHR5cGUgPT09ICcmJykge1xuICAgICAgICBub25TcGFjZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICc9Jykge1xuICAgICAgICAvLyBTZXQgdGhlIHRhZ3MgZm9yIHRoZSBuZXh0IHRpbWUgYXJvdW5kLlxuICAgICAgICBjb21waWxlVGFncyh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIHRoZXJlIGFyZSBubyBvcGVuIHNlY3Rpb25zIHdoZW4gd2UncmUgZG9uZS5cbiAgICBvcGVuU2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuXG4gICAgaWYgKG9wZW5TZWN0aW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzY2FubmVyLnBvcyk7XG5cbiAgICByZXR1cm4gbmVzdFRva2VucyhzcXVhc2hUb2tlbnModG9rZW5zKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgdGhlIHZhbHVlcyBvZiBjb25zZWN1dGl2ZSB0ZXh0IHRva2VucyBpbiB0aGUgZ2l2ZW4gYHRva2Vuc2AgYXJyYXlcbiAgICogdG8gYSBzaW5nbGUgdG9rZW4uXG4gICAqL1xuICBmdW5jdGlvbiBzcXVhc2hUb2tlbnMgKHRva2Vucykge1xuICAgIHZhciBzcXVhc2hlZFRva2VucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuLCBsYXN0VG9rZW47XG4gICAgZm9yICh2YXIgaSA9IDAsIG51bVRva2VucyA9IHRva2Vucy5sZW5ndGg7IGkgPCBudW1Ub2tlbnM7ICsraSkge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIGlmICh0b2tlbikge1xuICAgICAgICBpZiAodG9rZW5bMF0gPT09ICd0ZXh0JyAmJiBsYXN0VG9rZW4gJiYgbGFzdFRva2VuWzBdID09PSAndGV4dCcpIHtcbiAgICAgICAgICBsYXN0VG9rZW5bMV0gKz0gdG9rZW5bMV07XG4gICAgICAgICAgbGFzdFRva2VuWzNdID0gdG9rZW5bM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3F1YXNoZWRUb2tlbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgbGFzdFRva2VuID0gdG9rZW47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3F1YXNoZWRUb2tlbnM7XG4gIH1cblxuICAvKipcbiAgICogRm9ybXMgdGhlIGdpdmVuIGFycmF5IG9mIGB0b2tlbnNgIGludG8gYSBuZXN0ZWQgdHJlZSBzdHJ1Y3R1cmUgd2hlcmVcbiAgICogdG9rZW5zIHRoYXQgcmVwcmVzZW50IGEgc2VjdGlvbiBoYXZlIHR3byBhZGRpdGlvbmFsIGl0ZW1zOiAxKSBhbiBhcnJheSBvZlxuICAgKiBhbGwgdG9rZW5zIHRoYXQgYXBwZWFyIGluIHRoYXQgc2VjdGlvbiBhbmQgMikgdGhlIGluZGV4IGluIHRoZSBvcmlnaW5hbFxuICAgKiB0ZW1wbGF0ZSB0aGF0IHJlcHJlc2VudHMgdGhlIGVuZCBvZiB0aGF0IHNlY3Rpb24uXG4gICAqL1xuICBmdW5jdGlvbiBuZXN0VG9rZW5zICh0b2tlbnMpIHtcbiAgICB2YXIgbmVzdGVkVG9rZW5zID0gW107XG4gICAgdmFyIGNvbGxlY3RvciA9IG5lc3RlZFRva2VucztcbiAgICB2YXIgc2VjdGlvbnMgPSBbXTtcblxuICAgIHZhciB0b2tlbiwgc2VjdGlvbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgc3dpdGNoICh0b2tlblswXSkge1xuICAgICAgY2FzZSAnIyc6XG4gICAgICBjYXNlICdeJzpcbiAgICAgICAgY29sbGVjdG9yLnB1c2godG9rZW4pO1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICcvJzpcbiAgICAgICAgc2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuICAgICAgICBzZWN0aW9uWzVdID0gdG9rZW5bMl07XG4gICAgICAgIGNvbGxlY3RvciA9IHNlY3Rpb25zLmxlbmd0aCA+IDAgPyBzZWN0aW9uc1tzZWN0aW9ucy5sZW5ndGggLSAxXVs0XSA6IG5lc3RlZFRva2VucztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5lc3RlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsZSBzdHJpbmcgc2Nhbm5lciB0aGF0IGlzIHVzZWQgYnkgdGhlIHRlbXBsYXRlIHBhcnNlciB0byBmaW5kXG4gICAqIHRva2VucyBpbiB0ZW1wbGF0ZSBzdHJpbmdzLlxuICAgKi9cbiAgZnVuY3Rpb24gU2Nhbm5lciAoc3RyaW5nKSB7XG4gICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG4gICAgdGhpcy50YWlsID0gc3RyaW5nO1xuICAgIHRoaXMucG9zID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdGFpbCBpcyBlbXB0eSAoZW5kIG9mIHN0cmluZykuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5lb3MgPSBmdW5jdGlvbiBlb3MgKCkge1xuICAgIHJldHVybiB0aGlzLnRhaWwgPT09ICcnO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmllcyB0byBtYXRjaCB0aGUgZ2l2ZW4gcmVndWxhciBleHByZXNzaW9uIGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuICAgKiBSZXR1cm5zIHRoZSBtYXRjaGVkIHRleHQgaWYgaXQgY2FuIG1hdGNoLCB0aGUgZW1wdHkgc3RyaW5nIG90aGVyd2lzZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW4gPSBmdW5jdGlvbiBzY2FuIChyZSkge1xuICAgIHZhciBtYXRjaCA9IHRoaXMudGFpbC5tYXRjaChyZSk7XG5cbiAgICBpZiAoIW1hdGNoIHx8IG1hdGNoLmluZGV4ICE9PSAwKVxuICAgICAgcmV0dXJuICcnO1xuXG4gICAgdmFyIHN0cmluZyA9IG1hdGNoWzBdO1xuXG4gICAgdGhpcy50YWlsID0gdGhpcy50YWlsLnN1YnN0cmluZyhzdHJpbmcubGVuZ3RoKTtcbiAgICB0aGlzLnBvcyArPSBzdHJpbmcubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICogU2tpcHMgYWxsIHRleHQgdW50aWwgdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBjYW4gYmUgbWF0Y2hlZC4gUmV0dXJuc1xuICAgKiB0aGUgc2tpcHBlZCBzdHJpbmcsIHdoaWNoIGlzIHRoZSBlbnRpcmUgdGFpbCBpZiBubyBtYXRjaCBjYW4gYmUgbWFkZS5cbiAgICovXG4gIFNjYW5uZXIucHJvdG90eXBlLnNjYW5VbnRpbCA9IGZ1bmN0aW9uIHNjYW5VbnRpbCAocmUpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnRhaWwuc2VhcmNoKHJlKSwgbWF0Y2g7XG5cbiAgICBzd2l0Y2ggKGluZGV4KSB7XG4gICAgY2FzZSAtMTpcbiAgICAgIG1hdGNoID0gdGhpcy50YWlsO1xuICAgICAgdGhpcy50YWlsID0gJyc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDA6XG4gICAgICBtYXRjaCA9ICcnO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIG1hdGNoID0gdGhpcy50YWlsLnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKGluZGV4KTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBtYXRjaC5sZW5ndGg7XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSByZW5kZXJpbmcgY29udGV4dCBieSB3cmFwcGluZyBhIHZpZXcgb2JqZWN0IGFuZFxuICAgKiBtYWludGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgcGFyZW50IGNvbnRleHQuXG4gICAqL1xuICBmdW5jdGlvbiBDb250ZXh0ICh2aWV3LCBwYXJlbnRDb250ZXh0KSB7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLmNhY2hlID0geyAnLic6IHRoaXMudmlldyB9O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50Q29udGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNvbnRleHQgdXNpbmcgdGhlIGdpdmVuIHZpZXcgd2l0aCB0aGlzIGNvbnRleHRcbiAgICogYXMgdGhlIHBhcmVudC5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gbmFtZSBpbiB0aGlzIGNvbnRleHQsIHRyYXZlcnNpbmdcbiAgICogdXAgdGhlIGNvbnRleHQgaGllcmFyY2h5IGlmIHRoZSB2YWx1ZSBpcyBhYnNlbnQgaW4gdGhpcyBjb250ZXh0J3Mgdmlldy5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIGxvb2t1cCAobmFtZSkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGU7XG5cbiAgICB2YXIgdmFsdWU7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKHZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSlcbiAgICAgICAgICAgICAgbG9va3VwSGl0ID0gaGFzUHJvcGVydHkodmFsdWUsIG5hbWVzW2luZGV4XSk7XG5cbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWVbbmFtZXNbaW5kZXgrK11dO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlld1tuYW1lXTtcbiAgICAgICAgICBsb29rdXBIaXQgPSBoYXNQcm9wZXJ0eShjb250ZXh0LnZpZXcsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvb2t1cEhpdClcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIGNhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKVxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKHRoaXMudmlldyk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgV3JpdGVyIGtub3dzIGhvdyB0byB0YWtlIGEgc3RyZWFtIG9mIHRva2VucyBhbmQgcmVuZGVyIHRoZW0gdG8gYVxuICAgKiBzdHJpbmcsIGdpdmVuIGEgY29udGV4dC4gSXQgYWxzbyBtYWludGFpbnMgYSBjYWNoZSBvZiB0ZW1wbGF0ZXMgdG9cbiAgICogYXZvaWQgdGhlIG5lZWQgdG8gcGFyc2UgdGhlIHNhbWUgdGVtcGxhdGUgdHdpY2UuXG4gICAqL1xuICBmdW5jdGlvbiBXcml0ZXIgKCkge1xuICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhpcyB3cml0ZXIuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICB0aGlzLmNhY2hlID0ge307XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIGFuZCByZXR1cm5zIHRoZSBhcnJheSBvZiB0b2tlbnNcbiAgICogdGhhdCBpcyBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyc2UuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcbiAgICB2YXIgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdO1xuXG4gICAgaWYgKHRva2VucyA9PSBudWxsKVxuICAgICAgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdGFncyk7XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlciAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgdmFyIHRva2VucyA9IHRoaXMucGFyc2UodGVtcGxhdGUpO1xuICAgIHZhciBjb250ZXh0ID0gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3KTtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5zLCBjb250ZXh0LCBwYXJ0aWFscywgdGVtcGxhdGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgbWV0aG9kIHRoYXQgcmVuZGVycyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgdXNpbmdcbiAgICogdGhlIGdpdmVuIGBjb250ZXh0YCBhbmQgYHBhcnRpYWxzYC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBvcmlnaW5hbFRlbXBsYXRlYCBpcyBvbmx5IGV2ZXIgdXNlZCB0byBleHRyYWN0IHRoZSBwb3J0aW9uXG4gICAqIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHdhcyBjb250YWluZWQgaW4gYSBoaWdoZXItb3JkZXIgc2VjdGlvbi5cbiAgICogSWYgdGhlIHRlbXBsYXRlIGRvZXNuJ3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucywgdGhpcyBhcmd1bWVudCBtYXlcbiAgICogYmUgb21pdHRlZC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyVG9rZW5zID0gZnVuY3Rpb24gcmVuZGVyVG9rZW5zICh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIGJ1ZmZlciA9ICcnO1xuXG4gICAgdmFyIHRva2VuLCBzeW1ib2wsIHZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICBzeW1ib2wgPSB0b2tlblswXTtcblxuICAgICAgaWYgKHN5bWJvbCA9PT0gJyMnKSB2YWx1ZSA9IHRoaXMucmVuZGVyU2VjdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnXicpIHZhbHVlID0gdGhpcy5yZW5kZXJJbnZlcnRlZCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5yZW5kZXJQYXJ0aWFsKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICcmJykgdmFsdWUgPSB0aGlzLnVuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ25hbWUnKSB2YWx1ZSA9IHRoaXMuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ3RleHQnKSB2YWx1ZSA9IHRoaXMucmF3VmFsdWUodG9rZW4pO1xuXG4gICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZClcbiAgICAgICAgYnVmZmVyICs9IHZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJTZWN0aW9uID0gZnVuY3Rpb24gcmVuZGVyU2VjdGlvbiAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlciAodGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBzZWxmLnJlbmRlcih0ZW1wbGF0ZSwgY29udGV4dCwgcGFydGlhbHMpO1xuICAgIH1cblxuICAgIGlmICghdmFsdWUpIHJldHVybjtcblxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgZm9yICh2YXIgaiA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBqIDwgdmFsdWVMZW5ndGg7ICsraikge1xuICAgICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZVtqXSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVGVtcGxhdGUgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zIHdpdGhvdXQgdGhlIG9yaWdpbmFsIHRlbXBsYXRlJyk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHBvcnRpb24gb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgdGhlIHNlY3Rpb24gY29udGFpbnMuXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCBvcmlnaW5hbFRlbXBsYXRlLnNsaWNlKHRva2VuWzNdLCB0b2tlbls1XSksIHN1YlJlbmRlcik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVySW52ZXJ0ZWQgPSBmdW5jdGlvbiByZW5kZXJJbnZlcnRlZCAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuXG4gICAgLy8gVXNlIEphdmFTY3JpcHQncyBkZWZpbml0aW9uIG9mIGZhbHN5LiBJbmNsdWRlIGVtcHR5IGFycmF5cy5cbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4NlxuICAgIGlmICghdmFsdWUgfHwgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpXG4gICAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclBhcnRpYWwgPSBmdW5jdGlvbiByZW5kZXJQYXJ0aWFsICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMpIHtcbiAgICBpZiAoIXBhcnRpYWxzKSByZXR1cm47XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0aGlzLnBhcnNlKHZhbHVlKSwgY29udGV4dCwgcGFydGlhbHMsIHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnVuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gdW5lc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gZXNjYXBlZFZhbHVlICh0b2tlbiwgY29udGV4dCkge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiBtdXN0YWNoZS5lc2NhcGUodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmF3VmFsdWUgPSBmdW5jdGlvbiByYXdWYWx1ZSAodG9rZW4pIHtcbiAgICByZXR1cm4gdG9rZW5bMV07XG4gIH07XG5cbiAgbXVzdGFjaGUubmFtZSA9ICdtdXN0YWNoZS5qcyc7XG4gIG11c3RhY2hlLnZlcnNpb24gPSAnMi4xLjMnO1xuICBtdXN0YWNoZS50YWdzID0gWyAne3snLCAnfX0nIF07XG5cbiAgLy8gQWxsIGhpZ2gtbGV2ZWwgbXVzdGFjaGUuKiBmdW5jdGlvbnMgdXNlIHRoaXMgd3JpdGVyLlxuICB2YXIgZGVmYXVsdFdyaXRlciA9IG5ldyBXcml0ZXIoKTtcblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCBjYWNoZWQgdGVtcGxhdGVzIGluIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5jbGVhckNhY2hlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpbiB0aGUgZGVmYXVsdCB3cml0ZXIgYW5kIHJldHVybnMgdGhlXG4gICAqIGFycmF5IG9mIHRva2VucyBpdCBjb250YWlucy4gRG9pbmcgdGhpcyBhaGVhZCBvZiB0aW1lIGF2b2lkcyB0aGUgbmVlZCB0b1xuICAgKiBwYXJzZSB0ZW1wbGF0ZXMgb24gdGhlIGZseSBhcyB0aGV5IGFyZSByZW5kZXJlZC5cbiAgICovXG4gIG11c3RhY2hlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXJzIHRoZSBgdGVtcGxhdGVgIHdpdGggdGhlIGdpdmVuIGB2aWV3YCBhbmQgYHBhcnRpYWxzYCB1c2luZyB0aGVcbiAgICogZGVmYXVsdCB3cml0ZXIuXG4gICAqL1xuICBtdXN0YWNoZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscykge1xuICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHRlbXBsYXRlISBUZW1wbGF0ZSBzaG91bGQgYmUgYSBcInN0cmluZ1wiICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0IFwiJyArIHR5cGVTdHIodGVtcGxhdGUpICsgJ1wiIHdhcyBnaXZlbiBhcyB0aGUgZmlyc3QgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcmd1bWVudCBmb3IgbXVzdGFjaGUjcmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyknKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKTtcbiAgfTtcblxuICAvLyBUaGlzIGlzIGhlcmUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggMC40LnguLFxuICAvKmVzbGludC1kaXNhYmxlICovIC8vIGVzbGludCB3YW50cyBjYW1lbCBjYXNlZCBmdW5jdGlvbiBuYW1lXG4gIG11c3RhY2hlLnRvX2h0bWwgPSBmdW5jdGlvbiB0b19odG1sICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIHNlbmQpIHtcbiAgICAvKmVzbGludC1lbmFibGUqL1xuXG4gICAgdmFyIHJlc3VsdCA9IG11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oc2VuZCkpIHtcbiAgICAgIHNlbmQocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBlc2NhcGluZyBmdW5jdGlvbiBzbyB0aGF0IHRoZSB1c2VyIG1heSBvdmVycmlkZSBpdC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8yNDRcbiAgbXVzdGFjaGUuZXNjYXBlID0gZXNjYXBlSHRtbDtcblxuICAvLyBFeHBvcnQgdGhlc2UgbWFpbmx5IGZvciB0ZXN0aW5nLCBidXQgYWxzbyBmb3IgYWR2YW5jZWQgdXNhZ2UuXG4gIG11c3RhY2hlLlNjYW5uZXIgPSBTY2FubmVyO1xuICBtdXN0YWNoZS5Db250ZXh0ID0gQ29udGV4dDtcbiAgbXVzdGFjaGUuV3JpdGVyID0gV3JpdGVyO1xuXG59KSk7XG4iLCIvLyBDTEkgLSBWaWV3XG52YXIgQ0xJID0gcmVxdWlyZShcIi4vY2xpLmpzXCIpO1xudmFyIGRhdGEgPSByZXF1aXJlKFwiLi9kYXRhLmpzXCIpO1xudmFyIHRlbXBsYXRlID0gcmVxdWlyZShcIi4uL3RlbXBsYXRlL2xzLmpzXCIpO1xuXG52YXIgbXUgPSByZXF1aXJlKFwibXVzdGFjaGVcIik7XG5cbi8vIG11LnJvb3QgPSBcIi4uL3RlbXBsYXRlXCJcblxudmFyIGNsaSA9IG5ldyBDTEkoZGF0YSwgXCJyb290XCIsIFwia2hhbGVkXCIpO1xuXG5cbmZ1bmN0aW9uIERpc3BsYXkoc2NyZWVuKSB7XG4gICAgdmFyIGlucHV0LCBVUF9LRVkgPSAzOCxcbiAgICAgICAgRE9XTl9LRVkgPSA0MCxcbiAgICAgICAgRU5URVJfS0VZID0gMTMsXG4gICAgICAgIEtfS0VZID0gNzUsXG4gICAgICAgIGJhY2tfa2V5ID0gMTA7XG5cbiAgICAvL3RvIHRyYWNrIGxvY2F0aW9uIGluIGxhc3RDb21tYW5kIFtdIGJ5IHVwL2Rvd24gYXJyb3cgXG4gICAgdGhpcy53aGVyZSA9IGNsaS5sYXN0Q29tbWFuZC5sZW5ndGg7XG5cbiAgICAvL01haW4gRWxlbWVudCAgXG4gICAgdGhpcy50ZXJtaW5hbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5yZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuaW5wdXREaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuaW5wdXRFbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJlbVwiKTtcbiAgICB0aGlzLmlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpO1xuICAgIC8vV2hlbiB1c2VyIGVudGVyIHNvbWV0aGluZyBcbiAgICB0aGlzLmlucHV0RW0uaW5uZXJIVE1MID0gY2xpLndvcmtpbmdEaXJlY3RvcnkgKyBcIiAkXCI7XG4gICAgdGhpcy5pbnB1dERpdi5jbGFzc05hbWUgPSBcImlucHV0RGl2XCI7XG4gICAgdGhpcy50ZXJtaW5hbC5jbGFzc05hbWUgPSBcInRlcm1pbmFsXCI7XG4gICAgdGhpcy50ZXJtaW5hbC5zZXRBdHRyaWJ1dGUoXCJ0YWJpbmRleFwiLCAxKVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vbGlzdGVuIHRvIGtleXN0cm9rZXMgaW5zaWRlIHRlcm1pbmFsIFxuICAgIHRoaXMudGVybWluYWwub25rZXlkb3duID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2goZS53aGljaCl7XG4gICAgICAgICAgICBjYXNlIEVOVEVSX0tFWTpcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IFxuICAgICAgICAgICAgICAgIGJyZWFrOyBcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc2VsZi5pbnB1dC5mb2N1cygpO1xuICAgIH1cblxuICAgIC8vY2FwdHVyZSBrZXkgc3Ryb2tlcyBpbnNpZGUgaW5wdXRcbiAgICB0aGlzLmlucHV0Lm9ua2V5dXAgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHN3aXRjaCAoZS53aGljaCkge1xuICAgICAgICAgICAgY2FzZSBFTlRFUl9LRVk6XG4gICAgICAgICAgICAgICAgc2VsZi5lbnRlcihlKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBVUF9LRVk6XG4gICAgICAgICAgICAgICAgc2VsZi51cGtleShlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgRE9XTl9LRVk6XG4gICAgICAgICAgICAgICAgc2VsZi5kb3dua2V5KGUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBlLmN0cmxLZXkgJiYgS19LRVk6XG4gICAgICAgICAgICAgICAgc2VsZi5jbGVhcigpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IHNjcm9sbCB0byB0aGUgYm90dG9tIFxuICAgICAgICAvLyB3aW5kb3cuc2Nyb2xsVG8oMCwgZG9jdW1lbnQuYm9keS5vZmZzZXRIZWlnaHQpO1xuICAgICAgICBzZWxmLnRlcm1pbmFsLnNjcm9sbFRvcCA9IHNlbGYudGVybWluYWwuc2Nyb2xsSGVpZ2h0O1xuICAgIH1cblxuICAgIC8vQXBwZW5kIHRvIHRoZSBnaXZlIGRpdlxuICAgIHRoaXMudGVybWluYWwuYXBwZW5kQ2hpbGQodGhpcy5yZXN1bHQpO1xuICAgIHRoaXMuaW5wdXREaXYuYXBwZW5kQ2hpbGQodGhpcy5pbnB1dEVtKTtcbiAgICB0aGlzLmlucHV0RGl2LmFwcGVuZENoaWxkKHRoaXMuaW5wdXQpO1xuICAgIHRoaXMudGVybWluYWwuYXBwZW5kQ2hpbGQodGhpcy5pbnB1dERpdilcbiAgICBzY3JlZW4uYXBwZW5kQ2hpbGQodGhpcy50ZXJtaW5hbClcblxufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucmVzdWx0LmlubmVySFRNTCA9IFwiXCI7XG4gICAgdGhpcy5pbnB1dC52YWx1ZSA9IFwiXCI7XG4gICAgcmV0dXJuO1xufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5lbnRlciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAvL0dVSSBBZmZlY3QgQ29tbWFuZHMgXG4gICAgaWYgKHRoaXMuaW5wdXQudmFsdWUgPT0gXCJjbGVhclwiKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdmFyIHZpZXcgPSB0aGlzLmdldFZpZXcodGhpcy5pbnB1dC52YWx1ZSk7XG5cbiAgICB0aGlzLnJlc3VsdC5pbnNlcnRBZGphY2VudEhUTUwoXCJiZWZvcmVlbmRcIiwgdmlldylcblxuICAgIC8vcmVzZXRcbiAgICB0aGlzLmlucHV0RW0uaW5uZXJIVE1MID0gY2xpLndvcmtpbmdEaXJlY3RvcnkgKyBcIiAkXCI7XG4gICAgdGhpcy5pbnB1dC52YWx1ZSA9ICcnO1xuICAgIHRoaXMud2hlcmUgPSBjbGkubGFzdENvbW1hbmQubGVuZ3RoO1xufVxuXG5EaXNwbGF5LnByb3RvdHlwZS51cGtleSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsZXRXaGVyZSA9IHRoaXMud2hlcmUgLSAxO1xuICAgIGlmIChsZXRXaGVyZSA+IC0xICYmIGxldFdoZXJlIDwgY2xpLmxhc3RDb21tYW5kLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmlucHV0LnZhbHVlID0gY2xpLmxhc3RDb21tYW5kWy0tdGhpcy53aGVyZV07XG4gICAgICAgIC8vc3RhcnQgZnJvbSB0aGUgZW5kIFxuICAgICAgICB2YXIgbGVuID0gdGhpcy5pbnB1dC52YWx1ZS5sZW5ndGg7IFxuICAgICAgICB0aGlzLmlucHV0LnNldFNlbGVjdGlvblJhbmdlKGxlbixsZW4pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5kb3dua2V5ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxldFdoZXJlID0gdGhpcy53aGVyZSArIDE7XG4gICAgaWYgKGxldFdoZXJlID4gLTEgJiYgbGV0V2hlcmUgPCBjbGkubGFzdENvbW1hbmQubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaW5wdXQudmFsdWUgPSBjbGkubGFzdENvbW1hbmRbKyt0aGlzLndoZXJlXTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJlYWNoZWQgdGhlIGxpbWl0IHJlc2V0IFxuICAgIHRoaXMud2hlcmUgPSBjbGkubGFzdENvbW1hbmQubGVuZ3RoO1xuICAgIHRoaXMuaW5wdXQudmFsdWUgPSAnJztcbn1cblxuRGlzcGxheS5wcm90b3R5cGUuZ2V0VmlldyA9IGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWV3SGVscGVyKGNsaS5ydW4oY29tbWFuZCkpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRWaWV3SGVscGVyKGUubWVzc2FnZSk7XG4gICAgfVxufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5nZXRWaWV3SGVscGVyID0gZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgdmFyIG9iaiA9IHtcbiAgICAgICAgd29ya2luZ0RpcmVjdG9yeTogY2xpLndvcmtpbmdEaXJlY3RvcnksXG4gICAgICAgIGNvbW1hbmQ6IGNsaS5sYXN0Q29tbWFuZFtjbGkubGFzdENvbW1hbmQubGVuZ3RoIC0gMV0sXG4gICAgICAgIHJlc3VsdDogcmVzdWx0XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNPYmplY3QocmVzdWx0KSkge1xuICAgICAgICBvYmouaXNDb21wYW55ID0gb2JqLnJlc3VsdC5jb21wYW55ID8gdHJ1ZSA6IGZhbHNlO1xuICAgICAgICByZXR1cm4gbXUudG9faHRtbCh0ZW1wbGF0ZS5zZWN0aW9uLCBvYmopO1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcbiAgICAgICAgb2JqLnJlc3VsdCA9IG9iai5yZXN1bHQuam9pbihcIiZuYnNwOyZuYnNwO1wiKTtcbiAgICAgICAgcmV0dXJuIG11LnRvX2h0bWwodGVtcGxhdGUubGlzdCwgb2JqKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbXUudG9faHRtbCh0ZW1wbGF0ZS5saXN0LCBvYmopO1xufVxuXG5EaXNwbGF5LnByb3RvdHlwZS5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmICFBcnJheS5pc0FycmF5KG9iaikgJiYgb2JqICE9PSBudWxsO1xufVxuXG5cblxuXG53aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuc2NyZWVuXCIpO1xuXG4gICAgdmFyIHNvbWUgPSBuZXcgRGlzcGxheShlbG0pO1xuXG4gICAgXG5cbiAgICAvL3doZW4gZmlyc3QgbG9hZGVkIFxuICAgIHNvbWUuaW5wdXQuZm9jdXMoKTtcbn1cbiIsIi8vQ0xJIC0gTW9kZWwgXG5cbmZ1bmN0aW9uIFN0b3JhZ2UoZGF0YSkge1xuICAgIHRoaXMuZGlyZWN0b3J5ID0gZGF0YSB8fCB7fTtcbn1cblxuXG5TdG9yYWdlLnByb3RvdHlwZS5kaXIgPSBmdW5jdGlvbihwd2QsIGRpcmVjdG9yeSkge1xuICAgIHZhciBjdXJyRGlyID0gdGhpcy5kaXJlY3Rvcnk7XG4gICAgdmFyIGRpcmVjdG9yeSA9IGRpcmVjdG9yeSB8fCBmYWxzZTsgXG4gICAgLy9pZiBkaXJlY3RvcnkgaXMgbm90IGdpdmVuIFxuICAgIHZhciBzdWJEaXIgPSBwd2Quc3BsaXQoJy8nKTtcbiAgICBzdWJEaXIuc2hpZnQoKTsgLy9yZW1vdmVzIHRoaXMucm9vdCBcbiAgICBpZiAocHdkID09ICcnIHx8IHB3ZCA9PSB1bmRlZmluZWQgfHwgcHdkID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJEaXI7XG4gICAgfVxuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YkRpci5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXRoaXMuaGFzKGN1cnJEaXIsIHN1YkRpcltpXSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiBUaGUgZGlyZWN0b3J5ICdcIiArIHN1YkRpcltpXSArIFwiJyBkb2VzIG5vdCBleGlzdFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlyZWN0b3J5KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNEaXJlY3RvcnkoY3VyckRpcltzdWJEaXJbaV1dKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNkOiAnXCIgKyBzdWJEaXJbaV0gICtcIicgaXMgbm90IGEgZGlyZWN0b3J5XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjdXJyRGlyID0gY3VyckRpcltzdWJEaXJbaV1dXG4gICAgfVxuICAgIHJldHVybiBjdXJyRGlyO1xufVxuXG5cblN0b3JhZ2UucHJvdG90eXBlLmxpc3QgPSBmdW5jdGlvbihwd2QpIHtcbiAgICB2YXIgbGlzdCA9IFtdO1xuICAgIHZhciBkaXIgPSB0aGlzLmRpcihwd2QpO1xuXG4gICAgZm9yICh2YXIgaSBpbiBkaXIpIHtcbiAgICAgICAgaWYgKGRpci5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICAgICAgaWYgKGkgIT0gXCJkaXJlY3RvcnlcIilcbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goaSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbGlzdDtcbn1cblN0b3JhZ2UucHJvdG90eXBlLmlzRGlyZWN0b3J5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShcImRpcmVjdG9yeVwiKSkge1xuICAgICAgICBpZiAob2JqW1wiZGlyZWN0b3J5XCJdID09IGZhbHNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufVxuU3RvcmFnZS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24oZGlyLCBzdWJEaXIpIHtcbiAgICBpZiAoZGlyLmhhc093blByb3BlcnR5KHN1YkRpcikpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RvcmFnZTtcbiIsIi8vIENMSSAtIENvbnRyb2xsZXJcbnZhciBTdG9yYWdlID0gcmVxdWlyZShcIi4vU3RvcmFnZS5qc1wiKTtcblxuLy8gQ0xJIC0gU2ltcGxlIHRoZSBydW5uZXIgQ29udHJvbGxlciBcbmZ1bmN0aW9uIENMSShkYXRhLCByb290LCBvd25lcikge1xuICAgIC8vdXNlciBpbmZvIFxuICAgIHRoaXMub3duZXIgPSBvd25lcjtcbiAgICB0aGlzLnJvb3QgID0gcm9vdCB8fCBcInJvb3RcIjtcbiAgICAvL3B3ZCBcbiAgICB0aGlzLndvcmtpbmdEaXJlY3RvcnkgPSBvd25lciB8fCB0aGlzLnJvb3QgO1xuICAgIC8vY29tbWFuZHMgc3RvcmFnZVxuICAgIHRoaXMubGFzdENvbW1hbmQgPSBbXTtcbiAgICB0aGlzLmNvbW1hbmRzID0gW1wibHNcIiwgXCJoZWxwXCIsIFwiP1wiLCBcImNkXCIsIFwiY2F0XCIsIFwicHdkXCIsIFwib3BlblwiXTtcbiAgICAvL3RoZSBkYXRhIG9iamVjdCBcbiAgICB0aGlzLmRhdGEgPSBuZXcgU3RvcmFnZShkYXRhKTtcbn1cblxuLy9DTEkgLSBCZWdpbiBQcm90b3R5cGUgXG5DTEkucHJvdG90eXBlLnNldFB3ZCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHRoaXMud29ya2luZ0RpcmVjdG9yeSA9IHRoaXMuY2xlYW5Qd2QocHdkKTtcbn1cblxuQ0xJLnByb3RvdHlwZS5jbGVhblB3ZCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHZhciBsaXN0RGlyZWN0b3J5ID0gcHdkLnNwbGl0KC9bXFxzfFxcL10vKTsgLy8gLiB8IHNwYWNlIHwgc2xhc2ggIFxuICAgIGZvciAodmFyIGkgPSBsaXN0RGlyZWN0b3J5Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChsaXN0RGlyZWN0b3J5W2ldLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbGlzdERpcmVjdG9yeS5zcGxpY2UoaSwgMSlcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy9jbGVhbiBwd2QgZnJvbSBzcGFjZXMvc2xhc2hlcyBhdCB0aGUgZW5kIG9mIHRoZSBsaW5rKHB3ZClcbiAgICByZXR1cm4gbGlzdERpcmVjdG9yeS5qb2luKCcvJyk7XG59LFxuQ0xJLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgYXJnID0gaW5wdXQuc3BsaXQoL1xccysvKTsgLy9yZW1vdmluZyB1bm5lY2Vzc2FyeSBzcGFjZXMgXG4gICAgdmFyIGNvbW1hbmQgPSBhcmdbMF0udG9Mb3dlckNhc2UoKTsgLy9cbiAgICB2YXIgcHdkID0gYXJnWzFdID8gdGhpcy5jbGVhblB3ZChhcmdbMV0pIDogdGhpcy53b3JraW5nRGlyZWN0b3J5O1xuXG4gICAgdGhpcy5sYXN0Q29tbWFuZC5wdXNoKGlucHV0KTsgXG5cbiAgICBpZiAodGhpcy5jb21tYW5kcy5pbmRleE9mKGNvbW1hbmQpID09IC0xKSB7XG4gICAgICAgIHRocm93IEVycm9yKFwiVW5rbm93biBjb21tYW5kICdcIiArIGNvbW1hbmQgKyBcIidcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm9wdGlvbihjb21tYW5kLCBwd2QpXG59LFxuQ0xJLnByb3RvdHlwZS5vcHRpb24gPSBmdW5jdGlvbihjb21tYW5kLCBwd2QpIHtcbiAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgY2FzZSAnbHMnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubHMocHdkKTtcbiAgICAgICAgY2FzZSAnPyc6XG4gICAgICAgIGNhc2UgJ2hlbHAnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGVscChwd2QpO1xuICAgICAgICBjYXNlICdjZCc6XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jZChwd2QpO1xuICAgICAgICBjYXNlICdjYXQnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2F0KHB3ZCk7XG4gICAgICAgIGNhc2UgJ29wZW4nOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3Blbihwd2QpO1xuICAgICAgICBjYXNlICdwd2QnOlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHdkKHB3ZClcbiAgICB9XG5cbn1cbkNMSS5wcm90b3R5cGUubHMgPSBmdW5jdGlvbihwd2QpIHtcbiAgICBpZihwd2QgIT09IHRoaXMud29ya2luZ0RpcmVjdG9yeSlcbiAgICAgICAgcHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuXG4gICAgZmlsZSA9IHRoaXMuZGF0YS5kaXIocHdkKTtcblxuICAgIGlmICghdGhpcy5kYXRhLmlzRGlyZWN0b3J5KGZpbGUpKSB7XG4gICAgICAgIHJldHVybiBwd2Quc3BsaXQoJy8nKVsxXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5kYXRhLmxpc3QocHdkKTtcbn1cbkNMSS5wcm90b3R5cGUuaGVscCA9IGZ1bmN0aW9uKHB3ZCkge1xuICAgIHJldHVybiAoXCIgICA8cHJlPiBXZWxjb21lIHRvIFwiK3RoaXMub3duZXIrXCIncyBzZXJ2ZXIgdmlhIHRoZSB0ZXJtaW5hbFxcblwiK1xuICAgICAgICAgICAgXCIgICA/LCBoZWxwIDogc2hvd3Mgc29tZSBoZWxwZnVsIGNvbW1hbmRzLlxcblwiICtcbiAgICAgICAgICAgIFwiICAgICAgICBjZCA6IGNoYW5nZSBkaXJlY3RvcnkuXFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgIGxzIDogbGlzdCBkaXJlY3RvcnkgY29udGVudHMgXFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgcHdkIDogb3V0cHV0IHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XFxuXCIgK1xuICAgICAgICAgICAgXCIgICAgICAgY2F0IDogcHJpbnQgdGhlIGZpbGUg8J+YiS5cXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgICAgdmkgOiBjb21pbmcgb3V0IHNvb25cXG5cIiArXG4gICAgICAgICAgICBcIiAgICAgY2xlYXIgOiBjbGVhcnMgdGhlIGNvbnNvbGUuIHRyeSBcXCdjdHJsK2tcXCdcIitcbiAgICAgICAgICAgIFwiICAgPC9wcmU+XCIpXG4gICAgLy8gcmV0dXJuIFwiJm5ic3A7Jm5ic3A7Y2Q6ICA8L2JyPiAmbmJzcDsmbmJzcDtsczogIDxicj4gJm5ic3A7Jm5ic3A7IDwvYnI+ICZuYnNwOyZuYnNwO2NhdDogcmVhZCBhIGZpbGUgPC9icj4gJm5ic3A7Jm5ic3A7XCI7XG59XG5DTEkucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbihwd2QpIHtcbiAgICB2YXIgcHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuICAgIHZhciBkaXIgPSB0aGlzLmRhdGEuZGlyKHB3ZCk7XG4gICAgaWYodGhpcy5kYXRhLmlzRGlyZWN0b3J5KGRpcikpe1xuICAgICAgICB0aHJvdyBFcnJvcihcInNvcnJ5IHRoZXJlIGlzIG5vIHN1cHBvcnQgdG8gJ29wZW4nIGRpcmVjdG9yaWVzIHlldCA6KFwiKVxuICAgIH1cbiAgICBpZihkaXIudXJsID09IHVuZGVmaW5lZCB8fCBkaXIudXJsID09IG51bGwpe1xuICAgICAgICB0aHJvdyBFcnJvcihcIm5vIFVSTCBpcyBzcGVjaWZ5IHRvIGJlIG9wZW4hXCIpXG4gICAgfVxuICAgIHdpbmRvdy5vcGVuKGRpci51cmwpXG4gICAgcmV0dXJuIGRpci51cmw7XG59XG5cbkNMSS5wcm90b3R5cGUuY2F0ID0gZnVuY3Rpb24ocHdkKSB7XG5cdHZhciBmdWxsUHdkID0gdGhpcy5jbGVhblB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkgKyAnLycgKyBwd2QpO1xuXG4gICAgdmFyIGZpbGUgPSB0aGlzLmRhdGEuZGlyKGZ1bGxQd2QpOyBcbiAgICBpZiAodGhpcy5kYXRhLmlzRGlyZWN0b3J5KGZpbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhdDogJ1wiICsgcHdkICArXCInIGlzIGEgZGlyZWN0b3J5XCIpXG4gICAgfVxuICAgIHJldHVybiBmaWxlO1xufVxuXG5DTEkucHJvdG90eXBlLnB3ZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIi9cIit0aGlzLndvcmtpbmdEaXJlY3Rvcnk7XG59XG5DTEkucHJvdG90eXBlLmNkID0gZnVuY3Rpb24ocHdkKSB7XG4gICAgaWYgKHB3ZCA9PSBcIi4uXCIpIHtcbiAgICAgICAgdmFyIGFycmF5RGlyZWN0b3J5ID0gdGhpcy53b3JraW5nRGlyZWN0b3J5LnNwbGl0KCcvJyk7XG4gICAgICAgIGlmKGFycmF5RGlyZWN0b3J5Lmxlbmd0aCA+IDEpe1xuICAgICAgICAgICAgYXJyYXlEaXJlY3RvcnkucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgcHdkID0gYXJyYXlEaXJlY3Rvcnkuam9pbignLycpXG4gICAgICAgIHRoaXMud29ya2luZ0RpcmVjdG9yeSA9IHB3ZDtcbiAgICB9IGVsc2Uge1xuXHQgICAgdmFyIHB3ZCA9IHRoaXMuY2xlYW5Qd2QodGhpcy53b3JraW5nRGlyZWN0b3J5ICsgJy8nICsgcHdkKTtcbiAgICAgICAgLy9jaGVjayBpZiB0aGUgcHdkIGlzIGEgZGlyZWN0b3J5IFxuICAgICAgICB0aGlzLmRhdGEuZGlyKHB3ZCwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy53b3JraW5nRGlyZWN0b3J5ID0gcHdkOyBcbiAgICB9XG5cbiAgICB0aGlzLnNldFB3ZCh0aGlzLndvcmtpbmdEaXJlY3RvcnkpO1xuXG4gICAgcmV0dXJuICcnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENMSTsgXG4iLCIvL0V4cGVyaWVuY2UgXG52YXIgVEZBID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiVGVhY2ggRm9yIEFtZXJpY2FcIixcbiAgICBcInN1YkhlYWRlclwiOiBcIkZyb250LUVuZCBEZXZlbG9wZXJcIixcbiAgICBcImRldGFpbFwiOiBbXCJMb3Qgb2YgSmF2YVNyaXB0LCBIVE1MLCAmIENTU1wiXSxcbiAgICBcImxvY2F0aW9uXCI6IFwiTllDLCBOZXcgWW9ya1wiLFxuICAgIFwicGVyaW9kXCI6IFwiQXVndXN0LURlY2VtYmVyIGAxNFwiLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly93d3cudGVhY2hmb3JhbWVyaWNhLm9yZy9cIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG52YXIgQUJDID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQUJDIEdsb2JhbCBTeXN0ZW1cIixcbiAgICBcInN1YkhlYWRlclwiOiBcIlNvZnR3YXJlIERldmVsb3BlclwiLFxuICAgIFwiZGV0YWlsXCI6IFtcIvCfk4kgQ3JlYXRlIHNvZnR3YXJlIHRvIG1hbmlwdWxhdGUgYW5kIGV4dHJhY3QgZGF0YSB1c2luZyBSZWdleCBFeHByZXNzaW9uIHdpdGggSmF2YSBvbiBVTklYIHN5c3RlbSBcIixcbiAgICAgICAgXCLwn5K7IERldmVsb3BlZCB3ZWIgYXBwbGljYXRpb25zIHVzaW5nIEhUTUwvWEhUTUwsIENTUyBhbmQgSmF2YVNjcmlwdCB3aXRoIFBIUCAmYW1wOyBNeVNRTCBcIixcbiAgICAgICAgXCLwn5OwIENyZWF0ZSBhbmQgbWFuYWdlIENNUyB1c2luZyBXb3JkUHJlc3MgdG8gZW5zdXJlIHNlY3VyaXR5IGFuZCBlZmZpY2llbmN5IGZvciB0aGUgRW5kLVVzZXJzXCJcbiAgICBdLFxuICAgIFwicGVyaW9kXCI6IFwiSmFudWFyeS1BdWd1c3QgJzE0XCIsXG4gICAgXCJsb2NhdGlvblwiOiBcIk5ZQywgTmV3IFlvcmtcIixcbiAgICBcInVybFwiOiBcInd3dy5hYmNnbG9iYWxzeXN0ZW1zLmNvbS9cIixcbiAgICBcImRpcmVjdG9yeVwiOiBmYWxzZVxufVxuXG4vL0JpbmFyeUhlYXBcbnZhciBCaW5hcnlIZWFwID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQmluYXJ5SGVhcFwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiT3Blbi1Tb3VyY2VcIixcbiAgICBcImRldGFpbFwiOiBcIkJpbmFyeUhlYXAgSW1wbGVtZW50YXRpb24gYXMgQmluYXJ5VHJlZS1saWtlIHN0cnVjdHVyZVwiLFxuICAgIFwibG9jYXRpb25cIjogXCJBZGVuLCBZZW1lblwiLFxuICAgIFwicGVyaW9kXCI6IFwiU2VwdGVtYmVyXCIsXG4gICAgXCJ1cmxcIjogXCJodHRwczovL2dpdGh1Yi5jb20vS2hhbGVkTW9oYW1lZFAvQmluYXJ5SGVhcFwiLFxuICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlLFxufVxuXG52YXIgSHVmZm1hbmRDb2RpbmcgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJIdWZmbWFuQ29kaW5nXCIsXG4gICAgXCJzdWJIZWFkZXJcIjogXCJPcGVuLVNvdXJjZVwiLFxuICAgIFwiZGV0YWlsXCI6IFwiSHVmZm1hbmRDb2RpbmcgdXNpbmcgSlMsIEhUTUwsIENTUyBDT09MIGh1aFwiLFxuICAgIFwibG9jYXRpb25cIjogXCJBZGVuLCBZZW1lblwiLFxuICAgIFwicGVyaW9kXCI6IFwiSnVuZVwiLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9raGFsZWRtLmNvbS9odWZmbWFuXCIsXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn1cblxuLy9za2lsbHNcbnZhciBza2lsbHMgPSB7XG4gICAgXCJoZWFkZXJcIjogXCJTa2lsbHNcIixcbiAgICBcInN1YkhlYWRlclwiOiBcIvCflKcgVG9vbHMgSSd2ZSB1c2VkXCIsXG4gICAgXCJwZXJpb2RcIjogXCIyMDA2LVwiICsgbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpLnRvU3RyaW5nKCksXG4gICAgXCJkZXRhaWxcIjogW1xuICAgICAgICBcIuKckyBMYW5ndWFnZXM6IEphdmFTY3JpcHQsICBDKyssIEphdmEgLCAmIE90aGVyc1wiLFxuICAgICAgICBcIuKckyBKUyBGcmFtZXdvcms6IEpRdWVyeSwgQW5ndWxhckpTLCBCYWNrYm9uZS5qcywgJiBEM0pTXCIsXG4gICAgICAgIFwi4pyTIE9wZW4tU291cmNlOiBXb3JkUHJlc3MsIHZCdWxsdGluLCAmIFhlbkZvcm8gXCJcbiAgICBdLFxuICAgIFwidXJsXCI6IFwiaHR0cHM6Ly9naXRodWIuY29tL0toYWxlZE1vaGFtZWRQXCIsXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn07XG5cbnZhciBjZXJ0aWZpY2F0aW9uID0ge1xuICAgIFwiaGVhZGVyXCI6IFwiQ2VydGlmaWNhdGlvblwiLFxuICAgIFwic3ViSGVhZGVyXCI6IFwiTGlzdCBvZiBjZXJ0aWZpY2F0aW9uIChJVClcIixcbiAgICBcImRldGFpbFwiOiBbXG4gICAgICAgIFwi4pyTIENvbXBUSUEgQSsgLCBDb21wVElBIExpY2Vuc2UgTUhHQ0hQQlJMRjFRUVBGXCIsXG4gICAgICAgIFwi4pyTIE1pY3Jvc29mdCBDZXJ0aWZpZWQgUHJvZmVzc2lvbmFsLCBNaWNyb3NvZnQgTGljZW5zZSBFNzg1wq01NDc5XCIsXG4gICAgICAgIFwi4pyTIFNlcnZlciBWaXJ0dWFsaXphdGlvbiB3aXRoIFdpbmRvd3MgU2VydmVyIEh5cGVywq1WIGFuZCBTeXN0ZW0gQ2VudGVyLCBNaWNyb3NvZnRcIlxuICAgIF0sXG4gICAgXCJkaXJlY3RvcnlcIjogZmFsc2Vcbn1cblxuLy9lZHVjYXRpb24gXG52YXIgZWR1Y2F0aW9uID0ge1xuICAgICAgICBcImhlYWRlclwiOiBcIkJyb29rbHluIENvbGxlZ2VcIixcbiAgICAgICAgXCJzdWJIZWFkZXJcIjogXCLwn46TIENvbXB1dGVyIFNjaWVuY2VcIixcbiAgICAgICAgXCJwZXJpb2RcIjogXCIyMDEwLTIwMTRcIixcbiAgICAgICAgXCJkZXRhaWxcIjogW1xuICAgICAgICAgICAgXCJEZWFuIGxpc3QgJzEzICcxNFwiLFxuICAgICAgICAgICAgXCJDUyBNZW50b3Igd2l0aCB0aGUgRGVwYXJ0bWVudCBvZiBDb21wdXRlciBTY2llbmNlXCIsXG4gICAgICAgIF0sXG4gICAgICAgIFwiZGlyZWN0b3J5XCI6IGZhbHNlXG4gICAgfVxuICAgIC8vRmlsZSBzdHJ1Y3R1cmVcbnZhciBkaXJlY3RvcnkgPSB7XG4gICAgXCJleHBlcmllbmNlXCI6IHtcbiAgICAgICAgXCJURkFcIjogVEZBLFxuICAgICAgICBcIkFCQ1wiOiBBQkMsXG4gICAgfSxcbiAgICBcInByb2plY3RzXCI6IHtcbiAgICAgICAgXCJCaW5hcnlIZWFwXCI6IEJpbmFyeUhlYXAsXG4gICAgICAgIFwiSHVmZm1hbmRDb2RpbmdcIjogSHVmZm1hbmRDb2RpbmcsXG4gICAgfSxcbiAgICBcIm90aGVyc1wiOiB7XG4gICAgICAgIFwiZWR1Y2F0aW9uXCI6IGVkdWNhdGlvbixcbiAgICAgICAgXCJza2lsbHNcIjogc2tpbGxzLFxuICAgICAgICBcImNlcnRpZmljYXRpb25cIjogY2VydGlmaWNhdGlvblxuICAgIH1cblxufVxubW9kdWxlLmV4cG9ydHMgPSBkaXJlY3Rvcnk7XG4iLCJ2YXIgc2VjdGlvbiA9IFtcIjxkaXY+XCIsXG5cdFx0XHRcdFx0XCI8ZW0+e3t3b3JraW5nRGlyZWN0b3J5fX0gJCB7e2NvbW1hbmR9fTwvZW0+XCIsXG5cdFx0XHRcdFwiPC9kaXY+XCIsXG5cdFx0XHRcdFwiPGRpdiBjbGFzcz1cXFwic2VjdGlvblxcXCI+XCIsXG5cdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJoZWFkZXJcXFwiPlwiLFxuXHRcdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJ0aXRsZVxcXCI+XCIsXG5cdFx0XHRcdFx0XHRcdFwiPGI+e3tyZXN1bHQuaGVhZGVyfX08L2I+XCIsXG5cdFx0XHRcdFx0XHRcdFwiPC9icj5cIixcblx0XHRcdFx0XHRcdFx0XCI8ZW0+fiB7e3Jlc3VsdC5zdWJIZWFkZXJ9fTwvZW0+XCIsIFxuXHRcdFx0XHRcdFx0XCI8L2Rpdj5cIixcblx0XHRcdFx0XHRcdFwiPGIgY2xhc3M9XFxcInBlcmlvZFxcXCI+ICB7e3Jlc3VsdC5sb2NhdGlvbn19ICA8L2JyPiB7e3Jlc3VsdC5wZXJpb2R9fTwvYj5cIixcblx0XHRcdFx0XHRcIjwvZGl2PlwiLFxuXHRcdFx0XHRcdFwiPGRpdiBjbGFzcz1cXFwiY2xlYXJmaXhcXFwiPjwvZGl2PiBcIixcblx0XHRcdFx0XHRcIjxocj4gXCIsXG5cdFx0XHRcdFx0XCI8ZGl2IGNsYXNzPVxcXCJkZXRhaWxzXFxcIj4gXCIsXG5cdFx0XHRcdFx0XHRcIjx1bD57eyNyZXN1bHQuZGV0YWlsfX0gPGxpPnt7Ln19PC9saT57ey9yZXN1bHQuZGV0YWlsfX08L3VsPlwiLFxuXHRcdFx0XHRcdFwiPC9kaXY+XCIsXG5cdFx0XHRcdFwiPC9kaXY+XCJdLmpvaW4oXCJcXG5cIik7XG5cbnZhciBsaXN0ID0gW1wiPGRpdiBjbGFzcz1cXFwibGlzdFxcXCI+IFwiLFxuXHQgICAgXHRcdFwiPGVtPnt7d29ya2luZ0RpcmVjdG9yeX19ICQge3tjb21tYW5kfX08L2VtPlwiLCBcblx0ICAgIFx0XHRcIjxwPnt7JnJlc3VsdH19PC9wPlwiLFxuICAgIFx0XHRcIjwvZGl2PlwiXS5qb2luKFwiXFxuXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzZWN0aW9uOiBzZWN0aW9uLFxuICAgIGxpc3Q6IGxpc3Rcbn0iXX0=
