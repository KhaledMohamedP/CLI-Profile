var Display = require("./Display.js");

window.onload = function() {
    var div = document.querySelector(".screen");

    var screen = new Display(div);

    // focused on terminal input when screen is loaded 
    screen.input.focus();
};
