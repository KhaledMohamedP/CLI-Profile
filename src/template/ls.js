var experience = ["<div>",
					"<em>$ {{command}}</em>",
				"</div>",
				"<div class=\"experience\">",
					"<b>{{result.company}}</b>",
					"</br>",
					"<em>{{result.title}}</em>", 
					"<b class=\"period\"> {{result.period}} | {{result.location}}</b>",
					"<hr> ",
					"<div class=\"details\"> ",
						"{{result.detail}}",
					"</div>",
				"</div>"].join("\n");

var list = ["<div> ",
	    		"<em>$ {{command}}</em>", 
	    		"<p>{{result}}</p>",
    		"</div>"].join("\n");

module.exports = {
    experience: experience,
    list: list
}