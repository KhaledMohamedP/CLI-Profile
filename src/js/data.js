//Experience 
var TFA = {
    "Company": "Teach For America",
    "Title": "Front-End Junior Developer",
    "Detail": "A lot of JavaSript work",
    "Time": "August-December",
    "directory": false
}

var ABC = {
    "Company": "ABC Global System",
    "Title": "Software Developer",
    "Detail": "A lot of Java work",
    "Time": "August-December",
    "directory": false
}

//BinaryHeap
var BinaryHeap = {
    "Title": "BinaryHeap",
    "Detail": "BinaryHeap Implementation as BinaryTree-like structure",
    "Time": "September",
    "directory": false
}

var HuffmandCoding = {
    "Title": "HuffmandCoding",
    "Detail": "HuffmandCoding using JS, HTML, CSS COOL huh",
    "Time": "June",
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
