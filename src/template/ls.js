var section = ["<div>",
					"<em>{{workingDirectory}} >$ {{command}}</em>",
				"</div>",
				"<div class=\"section\">",
					"<div class=\"header\">",
						"<div class=\"title\">",
							"<b>{{result.header}}</b>",
							"</br>",
							"<em>~ {{result.subHeader}}</em>", 
						"</div>",
						"<b class=\"period\">  {{result.location}}  </br> {{result.period}}</b>",
					"</div>",
					"<div class=\"clearfix\"></div> ",
					"<hr> ",
					"<div class=\"details\"> ",
						"<ul>{{#result.detail}} <li>{{.}}</li>{{/result.detail}}</ul>",
					"</div>",
				"</div>"].join("\n");

var list = ["<div class=\"list\"> ",
	    		"<em>{{workingDirectory}} >$ {{command}}</em>", 
	    		"<p>{{&result}}</p>",
    		"</div>"].join("\n");

module.exports = {
    section: section,
    list: list
}