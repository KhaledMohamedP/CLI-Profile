var data = require("./data.js");
var CLI = require("../src/js/cli.js");


describe("testing", function() {
    var cli = new CLI(data);
    beforeEach(function(){
        
    });
    it('should return the correct directory ls', function() {
        var result = cli.run("ls")
        expect(result[0]).toEqual("Experience");
        cli.run("cd Experience");
        result = cli.run("ls");
        expect(result[0]).toEqual("TFA");

    });

    it("should not change working directory if given wrong pwd", function () {
        cli.run("cd Experience");
    	cli.run("cd llksfk");
		pwd = cli.run("pwd");
    	expect(pwd).toEqual("Experience");
    });

    it("should be able to go back .. and carries the correct pwd", function  () {
    	cli.run("cd ..")
		pwd = cli.run("pwd");
    	expect(pwd).toEqual("/");
    });
    it("should return an object", function(){
        expect(typeof cli.run("cat Experience/TFA")).toBe("object")
    });
});
