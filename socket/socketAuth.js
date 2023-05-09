const admin = require("../config/firebase-config")


//ran when checking if user has valid access token
//returns corresponding error / success code and message (as would be in authMiddleware)
module.exports = validateFirebaseIdToken = async(token) => {
    if(!token) return {code: 403, message: "Unauthorized", user:{}}

    try {
        const decodedIdToken = await admin.auth().verifyIdToken(token);
        //functions.logger.log('ID Token correctly decoded', decodedIdToken);        
        return {code: 200, message: "Authorized", user: decodedIdToken}
      } catch (error) {
        //functions.logger.error('Error while verifying Firebase ID token:', error);
        
        return {code: 403, message: "Unauthorized", user:{}}
      }
}