// CLI - View
var CLI = require("./cli.js");
var data = require("./data.js");
// var template = require("./template.js");

var mu = require("mustache");

// mu.root = "../template"

var cli = new CLI(data);
var display, inputDi, input, UP_KEY = 38,
    DOWN_KEY = 40,
    ENTER_KEY = 13,
    CTR_KEY = 91,
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
    inputDiv.innerHTML = "$ "
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
                console.log('the k key')
                break;
        }
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

    var commandLength = cli.lastCommand.length;

    var result = callCli(input.value);
    var obj = {
        result: result,
        command: cli.lastCommand[commandLength],
    }

    var view = mu.to_html("<div> <em>$ {{command}}</em> <p>{{result}}</p> </div>", obj);
    display.insertAdjacentHTML("beforeend", view)

    //reset
    input.value = '';
    where = cli.lastCommand.length;
}

function upkey(e) {
    var letWhere = where - 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        input.value = cli.lastCommand[--where];
        return;
    }
}

function downkey(e) {
    var letWhere = where + 1;
    if (letWhere > -1 && letWhere < cli.lastCommand.length) {
        input.value = cli.lastCommand[++where];
        return;
    }

    // reached the limit reset 
    where = cli.lastCommand.length;
    input.value = '';
}

function callCli(command) {
    try {
        return run(command)
    } catch (e) {
        return e.message;
    }
}

function run(command) {
    var result = cli.run(command);
    if (result instanceof Array) {
        return result.join('\n');
    }
    return result;
}

window.onload = Display(document.body);
