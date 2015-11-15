// CLI - View
var CLI = require("./cli.js");
var data = require("./data.js");
var template = require("../template/ls.js");

var mu = require("mustache");

var cli = new CLI(data, "root", "khaled");


function Display(screen) {
    var UP_KEY = 38,
        DOWN_KEY = 40,
        ENTER_KEY = 13,
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
            default:
                break;
        }
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
};

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
};

Display.prototype.upkey = function() {
    var letWhere = this.where - 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        this.input.value = cli.lastCommand[--this.where];
        //start from the end 
        var len = this.input.value.length;
        this.input.setSelectionRange(len, len);
        return;
    }
};

Display.prototype.downkey = function() {
    var letWhere = this.where + 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        this.input.value = cli.lastCommand[++this.where];
        return;
    }

    // reached the limit reset 
    this.where = cli.lastCommand.length;
    this.input.value = '';
};

Display.prototype.getView = function(command) {
    try {
        return this.getViewHelper(cli.run(command))
    } catch (e) {
        return this.getViewHelper(e.message);
    }
};

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

module.exports = Display; 