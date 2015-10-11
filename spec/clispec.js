var data = require("./data.js");
var CLI = require("../src/js/cli.js");


describe("testing", function() {
    var cli = new CLI(data);
    beforeEach(function() {

    });
    it('should return the correct directory ls', function() {
        var result = cli.run("ls")
        expect(result[0]).toEqual("experience");
        cli.run("cd experience");
        result = cli.run("ls");
        expect(result[0]).toEqual("TFA");

    });

    it("should not change working directory if given wrong pwd", function() {
        try {
            cli.run("cd llksfk");
        } catch (e) {} 

        pwd = cli.run("pwd");
        expect(pwd).toEqual("root/experience");
    });

    it("should throw an error", function  () {
        expect(function(){cli.run("cd llksfk")}).toThrow(); 
    })
    it("should be able to go back .. and carries the correct pwd", function() {
        cli.run("cd ..")
        pwd = cli.run("pwd");
        expect(pwd).toEqual("root");
    });

    it("should return an object", function() {
        expect(typeof cli.run("cat experience/TFA")).toBe("object")
    });
});
