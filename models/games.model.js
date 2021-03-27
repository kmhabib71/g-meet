const mongoose = require("mongoose");

var gamesSchema = new mongoose.Schema({
  title: {
    type: String,
  },
  creator: {
    type: String,
  },
  width: {
    type: Number,
  },
  height: {
    type: Number,
  },
  fileName: {
    type: String,
  },
  thumbnailFile: {
    type: String,
  },
  meetingid: {
    type: String,
  },
  username: {
    type: String,
  },
});
mongoose.model("games", gamesSchema);
