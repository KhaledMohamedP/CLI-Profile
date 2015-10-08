//CLI - Our stupid database 

function Storage(data) {
    this.directory = data || {};
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
            throw Error("cd: The directory '" + subDir[i] + "' does not exist");
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

module.exports = Storage;