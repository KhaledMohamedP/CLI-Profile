// CLI - Controller
var Storage = require("./Storage.js");

// CLI - Simple the runner Controller 
function CLI(data, root, owner) {
    //user info 
    this.owner = owner;
    this.root = root || "root";
    //pwd 
    this.workingDirectory = owner || this.root;
    //commands storage
    this.history = [];
    this.commands = ["ls", "help", "?", "cd", "cat", "pwd", "open"];
    //the data object 
    this.data = new Storage(data);
}

//CLI - Begin Prototype 
CLI.prototype.setPwd = function(pwd) {
    this.workingDirectory = this.cleanPwd(pwd);
};

CLI.prototype.cleanPwd = function(pwd) {

     // split if any of (. | space | slash) found in the string->pwd
    var listDirectory = pwd.split(/[\s|\/]/); 
    
    for (var i = listDirectory.length - 1; i >= 0; i--) {

        // Get rid off anything with zero length 
        if (listDirectory[i].length === 0) {
            listDirectory.splice(i, 1)
        }
    };

    //clean pwd from spaces/slashes
    return listDirectory.join('/');
};

CLI.prototype.run = function(input) {
    //removing unnecessary spaces
    var arg = input.split(/\s+/); 

    // The first argument should be CLI(e.g ls, cd, pwd ...)
    var command = arg[0].toLowerCase();

    //
    var pwd = arg[1] ? this.cleanPwd(arg[1]) : this.workingDirectory;

    // History: Store the command into the list of previous commands 
    this.history.push(input);

    if (this.commands.indexOf(command) == -1) {
        throw Error("Unknown command '" + command + "'");
    }
    return this.option(command, pwd);
};

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

};

CLI.prototype.ls = function(pwd) {
    if (pwd !== this.workingDirectory)
        pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);

    file = this.data.dir(pwd);

    if (!this.data.isDirectory(file)) {
        return pwd.split('/')[1];
    }

    return this.data.list(pwd);
};

CLI.prototype.help = function(pwd) {
    return ("   <pre> Welcome to " + this.owner + "'s server via the terminal\n" +
        "   ?, help : shows some helpful commands.\n" +
        "        cd : change directory.\n" +
        "        ls : list directory contents \n" +
        "       pwd : output the current working directory\n" +
        "       cat : print the file 😉.\n" +
        "        vi : coming out soon\n" +
        "     clear : clears the console. try \'ctrl+k\'" +
        "   </pre>");
};

CLI.prototype.open = function(pwd) {
    var pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);
    var dir = this.data.dir(pwd);
    if (this.data.isDirectory(dir)) {
        throw Error("No support to 'open' directories :(")
    }
    var url = dir.url || dir; 

    window.open(url);
    
    return dir.url;
};

CLI.prototype.cat = function(pwd) {
    var fullPwd = this.cleanPwd(this.workingDirectory + '/' + pwd);

    var file = this.data.dir(fullPwd);
    if (this.data.isDirectory(file)) {
        throw new Error("cat: '" + pwd + "' is a directory")
    }
    return file;
};

CLI.prototype.pwd = function() {
    return "/" + this.workingDirectory;
};

CLI.prototype.cd = function(pwd) {
    if (pwd == "..") {
        var arrayDirectory = this.workingDirectory.split('/');
        if (arrayDirectory.length > 1) {
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
};

module.exports = CLI;
