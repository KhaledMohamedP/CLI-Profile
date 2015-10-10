//Experience 
var TFA = {
    "company": "Teach For America",
    "title": "Front-End Junior Developer",
    "detail": "A lot of JavaSript work",
    "time": "August-December",
    "directory": false
}

var ABC = {
    "company": "ABC Global System",
    "title": "Software Developer",
    "detail": "A lot of Java work",
    "time": "August-December",
    "directory": false
}

//BinaryHeap
var BinaryHeap = {
    "title": "BinaryHeap",
    "detail": "BinaryHeap Implementation as BinaryTree-like structure",
    "time": "September",
    "directory": false
}

var HuffmandCoding = {
    "title": "HuffmandCoding",
    "detail": "HuffmandCoding using JS, HTML, CSS COOL huh",
    "time": "June",
    "directory": false
}

//File structure
var directory = {
    "Experience": {
        "TFA": TFA,
        "ABC": ABC,
    },
    "Project": {
        "BinaryHeap": BinaryHeap,
        "HuffmandCoding": HuffmandCoding,
    },
    "Skills": {
        "JavaScript": "Love JS",
        "C++": "Love C++",
        "Java": "love java",
        "others": "learn any tool within 7 days but to built a scalable software in that tool it will take me 20 years",
    }
}


module.exports = directory;
