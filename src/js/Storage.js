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
