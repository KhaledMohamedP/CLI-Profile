var data = require("./data.js");
var CLI = require("../src/js/cli.js");


describe("testing", function() {
    var cli = new CLI(data);
    it('should return the correct directory ls', function() {
        var result = cli.option("ls")
        expect(result[0]).toEqual("Experience");
        cli.option("cd Experience");
        result = cli.option("ls");
        expect(result[0]).toEqual("TFA");

    });

    it("should have the correct working directory", function  () {
    	cli.option("cd TFA");
    	var pwd = cli.option("pwd");
    	expect(pwd).toEqual("Experience/TFA");
    })

    it("should not change working directory if given wrong pwd", function () {
    	cli.option("cd llksfk");
		pwd = cli.option("pwd");
    	expect(pwd).toEqual("Experience/TFA");
    })

    it("should be able to go back .. and carries the correct pwd", function  () {
    	cli.option("cd ..")
		pwd = cli.option("pwd");
    	expect(pwd).toEqual("Experience");
    })
});
