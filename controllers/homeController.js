const express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const Employee = mongoose.model("Employee");
const games = mongoose.model("games");

// router.get("/", (req, res) => {
//   games
//     .find((err, docs) => {
//       res.render("home/appHome", {
//         listt: docs,
//       });
//     })
//     .lean();
// });
router.get("/", (req, res) => {
  games
    .find({ meetingid: "123123123123123" }, (err, docs) => {
      if (!err) {
        res.render("home/appHome", {
          listt: docs,
        });
      } else {
        console.log("Error in retrieving employee list :" + err);
      }
    })
    .lean();
});

module.exports = router;
