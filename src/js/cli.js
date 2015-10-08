// CLI - The screen 
var Storage = require("./Storage.js");

// CLI - Simple the runner Controller 
function CLI(data) {
    this.workingDirectory = ""
    this.lastCommand = [];
    this.data = new Storage(data);
    this.commands = ["ls", "help", "cd", "cat", "pwd"]
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
}
CLI.prototype.option = function(input) {
    var arg = input.split(/\s+/); //removing unnecessary spaces 
    var command = arg[0].toLowerCase(); //
    var pwd = arg[1] ? this.cleanPwd(arg[1]) : this.workingDirectory;

    this.lastCommand.push(input); 

    if (this.commands.indexOf(command) == -1) {
        throw Error("Unknown command '" + command + "'");
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
	var pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);
    return JSON.stringify(this.data.dir(pwd));
}

CLI.prototype.pwd = function() {
    if (this.workingDirectory == '') {
        return '/';
    }
    return this.workingDirectory;
}
CLI.prototype.cd = function(pwd) {
    if (pwd == "..") {
        var arrayDirectory = this.workingDirectory.split('/');
        arrayDirectory.pop();
        pwd = arrayDirectory.join('/')
        this.workingDirectory = pwd;
    } else if (pwd === "//") {
        this.workingDirectory = '/';
    } else {
	    var pwd = this.cleanPwd(this.workingDirectory + '/' + pwd);
	    try{
	        this.data.dir(pwd);
	        this.workingDirectory = pwd; 
	    }catch(e){
	    	return e;
	    }
    }

    this.setPwd(this.workingDirectory);

    return this.workingDirectory;
}


// CLI - End Prototype 

module.exports = CLI; 
var com = new CLI();

// try {
//     // var workingDirectory = '';
//     console.log(com.option('ls'))
//     console.log(com.option('cd Experience'));
//     console.log(com.option('ls'))
//     // console.log(com.option('cat Experience/TFA'));
//     // console.log(com.option('cd TFA'));

// } catch (e) {
//     console.log(e)
// }
