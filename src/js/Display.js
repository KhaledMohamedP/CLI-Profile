// CLI - View
var CLI = require("./cli.js");
var data = require("./data.js");
var template = require("../template/ls.js");

var mu = require("mustache");

// mu.root = "../template"

var cli = new CLI(data);
var display, inputDi, input, UP_KEY = 38,
    DOWN_KEY = 40,
    ENTER_KEY = 13,
    K_KEY = 75,
    where = cli.lastCommand.length;

function Display(screen) {
    //Main Element  
    display = document.createElement("div");
    inputDiv = document.createElement("div");
    input = document.createElement("input");
    //js setting 
    input.autofocus = true;
    //When user enter something 
    inputDiv.innerHTML = "$"
    inputDiv.style.color = "red"
    input.onkeyup = function(e) {
        switch (e.which) {
            case ENTER_KEY:
                enter(e)
                break;
            case UP_KEY:
                upkey(e);
                break;
            case DOWN_KEY:
                downkey(e);
                break;
                // case MAC_KEY && K_KEY:
            case e.ctrlKey && K_KEY:
                clear();
                break;
            default:
                break;
        }
        // Automatically scroll to the bottom 
        screen.scrollTop = screen.scrollHeight;
    }

    //
    screen.appendChild(display);
    inputDiv.appendChild(input);
    screen.appendChild(inputDiv)

}

function clear() {
    display.innerHTML = "";
    input.value = "";
    return;
}

function enter(e) {
    //GUI Affect Commands 
    if (input.value == "clear") {
        return clear();
    }

    var view = getView(input.value);

    display.insertAdjacentHTML("beforeend", view)

    //reset
    input.value = '';
    where = cli.lastCommand.length;
}

function upkey() {
    var letWhere = where - 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        input.value = cli.lastCommand[--where];
        return;
    }
}

function downkey() {
    var letWhere = where + 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        input.value = cli.lastCommand[++where];
        return;
    }

    // reached the limit reset 
    where = cli.lastCommand.length;
    input.value = '';
}

function getView(command) {
    try {
        return getViewHelper(cli.run(command))
    } catch (e) {
        return getViewHelper(e.message);
    }
}

function getViewHelper(result) {
    var obj = {
        command: cli.lastCommand[cli.lastCommand.length - 1],
        result: result
    }
    if(isObject(result)){
        obj.isCompany = obj.result.company? true:false; 
        return mu.to_html(template.experience, obj);
    }
    return mu.to_html(template.list, obj);
}

function isObject (obj) {
    return typeof obj === "object" && !Array.isArray(obj) && obj !== null;
}
window.onload = function() {
    var terminal = document.querySelector(".terminal");
    Display(terminal);
}
