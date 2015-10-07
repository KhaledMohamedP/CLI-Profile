//CLI - Our stupid database 
var data = require("./data.js");

function Storage() {
    this.directory = data;
}


Storage.prototype.dir = function(pwd) {
    var currDir = this.directory;

   	//if directory is not given 
    if (pwd == '' || pwd == undefined || pwd == null) {
        return currDir;
    }

    var subDir = pwd.split('/');
  
    for (var i = 0; i < subDir.length; i++) {
        if (!this.has(currDir, subDir[i])) {
            throw new Error("cd: The directory '" + subDir[i] + "' does not exist");
        } else {
            currDir = currDir[subDir[i]]
        }
    }

    return currDir;
}

Storage.prototype.list = function(pwd) {
    var list = [];
    var dir = this.dir(pwd);

    for (var i in dir) {
        if (dir.hasOwnProperty(i)) {
            list.push(i)
        }
    }
    return list;
}

Storage.prototype.has = function(dir, subDir) {
    if (dir.hasOwnProperty(subDir)) {
        return true
    }

    return false;
}


// CLI - The screen 
function Display(selctor) {
    this.tv = document.querySelector(selector);
}
// CLI - End The screen 

// CLI - Simple the runner Controller 
function CLI() {
    this.workingDirectory = ""
    this.data = new Storage();
    this.commands = ["ls", "help", "cd", "cat", "pwd"]
}

//CLI - Begin Prototype 
//
CLI.prototype.setPwd = function(pwd) {
    this.workingDirectory = this.cleanPwd(pwd);
}

CLI.prototype.cleanPwd = function(pwd) {
    var listDirectory = pwd.split(/[\.|\s|\/]/); // . | space | slash  
    for (var i = listDirectory.length - 1; i >= 0; i--) {
        if (listDirectory[i].length === 0) {
            listDirectory.splice(i, 1)
        }
    };

    //clean pwd from spaces/slashes at the end of the link(pwd)
    return listDirectory.join('/');
}
CLI.prototype.option = function(input) {
    var arg = input.split(/\s+/); //removing unnecessary spaces 
    var command = arg[0].toLowerCase(); //
    var pwd = arg[1] ? this.cleanPwd(arg[1]) : this.workingDirectory;

    if (this.commands.indexOf(command) == -1) {
        throw ("Unknown command '" + command + "'");
    }
    switch (command) {
        case 'ls':
            return this.ls(pwd);
        case 'help':
            return this.help(pwd);
        case 'cd':
            return this.cd(pwd);
        case 'cat':
            return this.cat(pwd);
        case 'pwd':
            return this.pwd(pwd)
    }


}
CLI.prototype.ls = function(pwd) {
    return this.data.list(pwd);
}
CLI.prototype.help = function(pwd) {
    return "I will help you soon";
}

CLI.prototype.cat = function(pwd) {
    return this.data.dir(pwd);
}

CLI.prototype.pwd = function() {
    if (this.workingDirectory == '') {
        return '/';
    }
    return this.workingDirectory;
}
CLI.prototype.cd = function(pwd) {
    var workingDirectory = '';
    if (pwd == "..") {
        var arrayDirectory = this.workingDirectory.split('/');
        arrayDirectory.pop();
        pwd = arrayDirectory.join('/')
        workingDirectory = pwd;
    } else if (pwd === "//") {
        workingDirectory = '/';
    } else {
        this.data.dir(pwd);
        workingDirectory += pwd;
    }

    this.setPwd(workingDirectory);

    return 'cd...';
}


// CLI - End Prototype 


var com = new CLI();

try {
    console.log(com.option('cd Experience'));
    console.log(com.option('cat Experience/TFA'));

} catch (e) {
    console.log(e)
}
