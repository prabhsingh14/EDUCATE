const mongoose = require("mongoose");
require("dotenv").config();

exports.connect = () => {
    mongoose.connect(process.env.MONGODB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology:true,
    })
    .then(() => console.log("Connection with database has been made successfully"))
    .catch( (error) => {
        console.log("Could not make connection with database");
        console.error(error);
        process.exit(1);
    } )
};
