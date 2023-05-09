const validateFirebaseIdToken = require("./socketAuth");
const admin = require("firebase-admin");
const { firestore } = require("firebase-admin");
const { getStorage } = require('firebase-admin/storage');

const TIME_LIMIT = 60 * 1000

let currentAuctionData;

module.exports = startSocket = async (server) => {

    const getSignedUrl = async (userId) => {
        const bucket = getStorage().bucket();
        const file = bucket.file(userId);
        const options = {
            version: 'v4',
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // URL expires in 1 hour 
        }

        const [url] = await file.getSignedUrl(options);
        return url
    }

    const initialiseBidEnvironment = async () => {
        const squareRef = admin.firestore().collection("squares").doc("0");
        const itemDoc = await squareRef.get();
        currentAuctionData = itemDoc.data();
    }

    await initialiseBidEnvironment();

    const io = require('socket.io')(server, {
        cors: {
            origin: ['http://localhost:3000']
        }
    })


    const waitForBidEndTime = (ms) => {
        //console.log("WAIT")
        const squareRef = admin.firestore().collection("squares").doc("0");
        setTimeout(async () => {
            //console.log("TIME LIMIT")
            let topBidExists = false;
            let winner;
            let nextBidId;
            let auctionEndTime;

            try {

                await admin.firestore().runTransaction(async (transaction) => {

                    const itemDoc = await transaction.get(squareRef);
                    const { nextBids, bidId } = itemDoc.data()

                    if (nextBids.length > 0) {
                        winner = nextBids[nextBids.length - 1];
                        //set doc to next state

                        auctionEndTime = (new Date).getTime() + TIME_LIMIT;

                        transaction.set(squareRef, {
                            bidId: bidId + 1,
                            nextBidWins: false,
                            nextBids: [],
                            ownerId: winner.uid,
                            ownerName: winner.name,
                            winningPrice: winner.value,
                            auctionEndTime,
                        })
                        topBidExists = true;
                        nextBidId = bidId + 1;
                    } else {
                        //NO BIDS: ENTER "next bid wins" MODE
                        transaction.update(squareRef, {
                            nextBidWins: true,
                        })
                    }

                })

                currentAuctionData.auctionEndTime = auctionEndTime;

            } catch (error) {
                console.error(error)
                return
            }

            if (topBidExists) {
                //console.log("TOP BIDS EXIST")
                onTopBidExists((new Date).getTime() + TIME_LIMIT, winner.name, winner.value, winner.uid, nextBidId);
                return;
            }

            //console.log("NO TOP BIDS EXIST")

            //Next bid wins
            io.emit("NBW")
            currentAuctionData.nextBidWins = true;

        }, ms)
    }

    const onTopBidExists = (auctionEndTime, winningName, winningBid, winningId, nextBidId) => {
        alertNewAuction(auctionEndTime, winningName, winningBid, winningId, nextBidId);
        removeFundsFromBalance(winningBid, winningId)

        //set new timeout for waiting for auction time to end
        waitForBidEndTime(auctionEndTime - (new Date()).getTime())
    }

    //alerts all connected users of new bid and sends details of previous winning one.
    const alertNewAuction = async (auctionEndTime, winningName, winningBid, winningId, bidId) => {
        //update local cache first
        currentAuctionData.bidId = bidId;
        currentAuctionData.ownerName = winningName;
        currentAuctionData.winningPrice = winningBid;
        currentAuctionData.nextBidWins = false;
        currentAuctionData.auctionEndTime = auctionEndTime;
        currentAuctionData.ownerId = winningId;

        

        //console.log("HERE")
        const url = await getSignedUrl(winningId)
        //console.log("HERE2")

        io.emit("Next Auction", { url, winningName, winningBid, auctionEndTime, bidId, auctionEndTime })

    }

    io.on('connection', async (socket) => {

        console.log('a user connected');

        console.log(currentAuctionData.ownerId)
        const url = await getSignedUrl(currentAuctionData.ownerId)

        //TODO: DON'T SEND USER ID
        socket.emit("welcome", { ...currentAuctionData, url })

        socket.on('bid', async ({ bid, userBidId, token }, callback) => {
            const { code, message, user } = await validateFirebaseIdToken(token);

            //TODO: IMPLEMENT THE CODE / MESSAGE BIT if not authenticated

            //try/catch or case for if no bid here??
            bid = parseFloat(bid)

            //transaction to change bid
            const squareRef = admin.firestore().collection("squares").doc("0");

            let wonByDefault = false;
            let currentBidId;
            let auctionEndTime;
            try {

                // Start a Firestore transaction
                await admin.firestore().runTransaction(async (transaction) => {
                    wonByDefault = false;
                    // Get the current highest bid for the square
                    const itemDoc = await transaction.get(squareRef);
                    const { nextBids, bidId, nextBidWins } = itemDoc.data();

                    currentBidId = bidId;

                    console.log(userBidId)
                    console.log(bidId)

                    //TODO: THIS DOESN'T WORK WITH 3 == signs (different datatypes??)
                    if (!(userBidId == bidId)) {
                        callback("Bid Unsuccessful")
                        throw new Error("Bid ids do not match")
                    }

                    //TODO:CHECK USER HAS ENOUGH MONEY #####################################################
                    const balanceRef = admin.firestore().collection("accountBalances").doc(user.uid);
                    const {balance} = (await transaction.get(balanceRef)).data();

                    if(balance < bid){
                        callback("Bid unsuccessful: insufficient balance")
                        throw new Error("insufficient account balance")
                    }

                    //get out of next bid wins state, and instantly win this square.

                    if (nextBidWins) {
                        auctionEndTime = (new Date).getTime() + TIME_LIMIT;
                        transaction.set(squareRef, {
                            bidId: bidId + 1,
                            nextBidWins: false,
                            nextBids: [],
                            ownerId: user.uid,
                            ownerName: user.name,
                            winningPrice: bid,
                            auctionEndTime,
                        })
                        wonByDefault = true;
                    } else {
                        // If the user's bid is higher, update the bid information
                        if (nextBids.length === 0 || bid > nextBids[nextBids.length - 1].value) {
                            // Update the squares's bid information


                            transaction.update(squareRef, {
                                nextBids: firestore.FieldValue.arrayUnion({ name: user.name, uid: user.uid, value: bid })
                            });


                        } else {
                            // If the user's bid is not higher, throw an error to roll back the transaction
                            callback("Bid unsuccessful")
                            throw new Error("Your bid must be higher than the current highest bid.");
                            //CODE STOPS HERE
                        }

                    }


                });


                callback("Bid Successful")
                console.log("Bid Successful")

                
                if (wonByDefault) {
                    currentAuctionData.auctionEndTime = auctionEndTime;
                    alertNewAuction(auctionEndTime, user.name, bid, user.uid, currentBidId + 1);
                    removeFundsFromBalance(bid,user.uid)

                    //set new timeout for waiting for auction time to end
                    waitForBidEndTime(auctionEndTime - (new Date()).getTime())
                    return
                }

                io.emit("newBid", { bid, name: user.name })


            } catch (error) {
                console.log("bid unsuccessful", error.message)
            }
        });

    });

    const removeFundsFromBalance = (bid, id) => {
        admin.firestore().collection("accountBalances").doc(id).update({
            balance: firestore.FieldValue.increment(-1 * bid)
        })
    }
}