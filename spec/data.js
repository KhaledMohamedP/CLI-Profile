//Experience 
var TFA = {
    "header": "Teach For America",
    "subHeader": "Front-End Developer",
    "detail": ["JavaSript, HTML, & CSS"],
    "location": "NYC, New York",
    "period": "August-December `14",
    "directory": false
}

var ABC = {
    "header": "ABC Global System",
    "subHeader": "Software Developer",
    "detail": "A lot of Java work",
    "period": "August-December",
    "location": "NYC, New York",
    "directory": false
}

//BinaryHeap
var BinaryHeap = {
    "header": "BinaryHeap",
    "subHeader": "Open-Source",
    "detail": "BinaryHeap Implementation as BinaryTree-like structure",
    "location": "Aden, Yemen",
    "period": "September",
    "directory": false
}

var HuffmandCoding = {
    "header": "HuffmandCoding",
    "subHeader": "Open-Source",
    "detail": "HuffmandCoding using JS, HTML, CSS COOL huh",
    "location": "Aden, Yemen",
    "period": "June",
    "directory": false
}

//skills
var skills = {
    "header": "Skills",
    "subHeader": "Tools I used over the years",
    "period": "2006-" + new Date().getFullYear().toString(),
    "detail": [
        "🙈Love JavaScript",
        "🏫Done college work in C++",
        "💥Java helped me become a developer",
        "✅Enjoy learning new tools everyday"
    ],
    "directory": false
};

//File structure
var directory = {
    "experience": {
        "TFA": TFA,
        "ABC": ABC,
    },
    "project": {
        "BinaryHeap": BinaryHeap,
        "HuffmandCoding": HuffmandCoding,
    },
    "skills": skills

}
module.exports = directory;
