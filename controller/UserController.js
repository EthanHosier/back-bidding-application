const { getStorage } = require('firebase-admin/storage');
const admin = require("../config/firebase-config")

exports.helloWorld = async (req, res, next) => {
    return res.status(200).send(JSON.stringify({ message: "Hello ssWorld" }))
}


exports.saveImage = async (req, res, next) => {
    console.log(" == post request recieved to /saveImage")

    const bucket = getStorage().bucket();

    try {
        // Get the uploaded file
        const file = req.file;
    
        // Generate a new filename
        const fileName = req.user.uid;
    

        // Create a new file in Firebase Storage
        const fileUpload = bucket.file(fileName);
        

        // Upload the file to Firebase Storage
        const stream = fileUpload.createWriteStream({
          metadata: {
            contentType: file.mimetype,
          },
        });
    
        stream.on("error", (err) => {
          console.error(err);
          res.status(500).send("Error uploading file");
        });
    
        stream.on("finish", async() => {
          console.log(`File uploaded successfully: ${fileName}`);
          res.status(200).send("Success");
        });
    
        stream.end(file.buffer);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error uploading file");
      }
    
}

exports.initialiseBalance = async (req, res, next) => {

  try{
    await admin.firestore().collection("accountBalances").doc(req.user.uid).set({
      balance:0,
    })
    return res.status(200).send(JSON.stringify({message: "Balance successfully set to 0"}))
  } catch (error){
    return res.status(500).send(JSON.stringify({message: error}))
  }
}