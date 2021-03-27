const mongoose = require("mongoose");

// mongoose.connect('mongodb://localhost:27017/EmployeeDB', { useNewUrlParser: true }, (err) => {
// mongoose.connect(
//   "mongodb+srv://kmhabib:khurshida@cluster0.qqlnw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
mongoose.connect(
  process.env.MONGODB_URI,
  {
    useNewUrlParser: true,
  },
  (err) => {
    if (!err) {
      console.log("MongoDB Connection Succeeded.");
    } else {
      console.log("Error in DB connection : " + err);
    }
  }
);

require("./employee.model");
require("./games.model");
