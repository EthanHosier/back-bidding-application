const express = require("express");
const app = express();

//TO FIX CORS PROBLEM
// Add headers before the routes are defined
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = 3500;
const server = app.listen(PORT, () => console.log(`Server connected to port ${PORT}`));


//create error handler which catches every unhandledRejection error
process.on("unhandledRejection", err=> {
    console.log(`an error occured: ${err.message}`);
    server.close(() => process.exit(1)) //logs out error + closes server w/ exit code of 1
});



const userRouter = require("./route/UserRoutes");

app.use("/user", userRouter);

const startSocket = require("./socket/SocketHandler");
startSocket(server);