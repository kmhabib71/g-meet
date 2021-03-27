require("./models/db");

const express = require("express");
const path = require("path");
const exphbs = require("express-handlebars");
const bodyparser = require("body-parser");

const employeeController = require("./controllers/employeeController");
const homeController = require("./controllers/homeController");
const loginController = require("./controllers/loginController");
const fileUpload = require("express-fileupload");
const fs = require("fs");
var connectionId;
var _userConnections = [];
var app = express();
app.use(
    bodyparser.urlencoded({
        extended: true,
    })
);
app.use(bodyparser.json());
app.set("views", path.join(__dirname, "/views/"));
app.engine(
    "hbs",
    exphbs({
        extname: "hbs",
        defaultLayout: "mainLayout",
        layoutsDir: __dirname + "/views/layouts/",
    })
);
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "hbs");

// app.listen(3000, () => {
//   console.log("Express server started at port : 3000");
// });

app.use("/employee", employeeController);
app.use("/", homeController);
app.use("/sign", loginController);
server = app.listen(process.env.PORT || 3000);
/*   for webrtc application */
const io = require("socket.io")(server);

//listen on every connection
io.on("connection", (socket) => {
    console.log(socket.id);

    socket.on("userconnect", (data) => {
        console.log("userconnect", data.dsiplayName, data.meetingid);

        var other_users = _userConnections.filter(
            (p) => p.meeting_id == data.meetingid
        );

        _userConnections.push({
            connectionId: socket.id,
            user_id: data.dsiplayName,
            meeting_id: data.meetingid,
        });
        var userCount = _userConnections.length;
        console.log(userCount);
        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("informAboutNewConnection", {
                other_user_id: data.dsiplayName,
                connId: socket.id,
                userNumber: userCount,
            });
        });

        socket.emit("userconnected", other_users);
        //return other_users;
    }); //end of userconnect

    socket.on("exchangeSDP", (data) => {
        socket.to(data.to_connid).emit("exchangeSDP", {
            message: data.message,
            from_connid: socket.id,
        });
    }); //end of exchangeSDP

    socket.on("reset", (data) => {
        var userObj = _userConnections.find((p) => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;
            var list = _userConnections.filter((p) => p.meeting_id == meetingid);
            _userConnections = _userConnections.filter(
                (p) => p.meeting_id != meetingid
            );

            list.forEach((v) => {
                socket.to(v.connectionId).emit("reset");
            });

            socket.emit("reset");
        }
    }); //end of reset

    socket.on("sendMessage", (msg) => {
        console.log(msg);
        var userObj = _userConnections.find((p) => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;
            var from = userObj.user_id;

            var list = _userConnections.filter((p) => p.meeting_id == meetingid);
            console.log(list);

            list.forEach((v) => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg,
                    time: getCurrDateTime(),
                });
            });

            socket.emit("showChatMessage", {
                from: from,
                message: msg,
                time: getCurrDateTime(),
            });
        }
    }); //end of reset

    socket.on("fileTransferToOther", function (msg) {
        console.log(msg);
        var userObj = _userConnections.find((p) => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;
            var from = userObj.user_id;

            var list = _userConnections.filter((p) => p.meeting_id == meetingid);
            console.log(list);

            list.forEach((v) => {
                socket.to(v.connectionId).emit("showFileMessage", {
                    from: from,
                    username: msg.username,
                    meetingid: msg.meetingid,
                    FileePath: msg.FileePath,
                    fileeName: msg.fileeName,
                    time: getCurrDateTime(),
                });
            });
        }
    });
    socket.on("disconnect", function () {
        console.log("Got disconnect!");

        var userObj = _userConnections.find((p) => p.connectionId == socket.id);
        if (userObj) {
            var meetingid = userObj.meeting_id;

            _userConnections = _userConnections.filter(
                (p) => p.connectionId != socket.id
            );
            var list = _userConnections.filter((p) => p.meeting_id == meetingid);

            list.forEach((v) => {
                var userCou = _userConnections.length;
                socket.to(v.connectionId).emit("informAboutConnectionEnd", {
                    connId: socket.id,
                    userCoun: userCou,
                });
            });
        }
    });
});

function getCurrDateTime() {
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();
    var dt =
        year +
        "-" +
        month +
        "-" +
        date +
        " " +
        hours +
        ":" +
        minutes +
        ":" +
        seconds;
    return dt;
}

// .........for file fileUpload.............
app.use(fileUpload());
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
var gameSchema = new mongoose.Schema({
    title: String,
    creator: String,
    width: Number,
    height: Number,
    fileName: String,
    thumbnailFile: String,
    meetingid: String,
    username: String,
});

var Game = mongoose.model("Game", gameSchema);

// app.get("/addgame", function (req, res) {
//   res.render("home/addgame");
// });

app.post("/attachimg_other_info", function (req, res) {
    var meeting_idd = req.body.meeting_id;
    res.send(meeting_idd);
});
app.post("/attachimg", function (req, res) {
    var data = req.body;

    //a variable representation of the files
    // var gameFile = req.files.gamefile;
    var imageFile = req.files.zipfile;
    console.log(imageFile);
    //Using the files to call upon the method to move that file to a folder
    // gameFile.mv("public/images/" + gameFile.name, function (error) {
    //   if (error) {
    //     console.log("Couldn't upload the game file");
    //     console.log(error);
    //   } else {
    //     console.log("Game file succesfully uploaded.");
    //   }
    // });
    var dir = "public/attachment/" + data.meeting_id + "/";
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    imageFile.mv(
        "public/attachment/" + data.meeting_id + "/" + imageFile.name,
        function (error) {
            if (error) {
                console.log("Couldn't upload the image file");
                console.log(error);
            } else {
                console.log("Image file succesfully uploaded.");
            }
        }
    );

    Game.create({
            title: data.title,
            creator: data.creator,
            width: data.width,
            height: data.height,
            thumbnailFile: imageFile.name,
            meetingid: data.meeting_id,
            username: data.username,
        },
        function (error, data) {
            if (error) {
                console.log("There was a problem adding this game to the database");
            } else {
                console.log("Game added to database");
                console.log(data);
            }
        }
    );
    // res.redirect("/?meetingID=324234324");
    res.send(data.creator);
    // return true;
    // res.writeHead(200, { "Content-Type": "text/plain" });
    // res.write("feeling cool");
    // res.end();
});
