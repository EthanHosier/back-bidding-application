var admin = require("firebase-admin");

var serviceAccount = require("./choosethisimage-firebase-adminsdk-1c1bt-b1f05c7d13.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'choosethisimage.appspot.com'
});

module.exports = admin;