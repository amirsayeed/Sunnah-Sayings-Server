const express = require('express')
const cors = require('cors');
const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');
require('dotenv').config();
const admin = require("firebase-admin");
const app = express()
const port = process.env.PORT || 5000;

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://sunnah-sayings.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());

const decodedKey = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dse9fiu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        //await client.connect();
        const usersCollection = client.db("sunnah_db").collection("users");
        const quotesCollection = client.db("sunnah_db").collection("quotes");

        const verifyFbToken = async (req, res, next) => {
            const authHeader = req.headers?.authorization;
            // console.log(authHeader);

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send({
                    message: 'unauthorized access'
                });
            }

            const token = authHeader.split(' ')[1];

            try {
                const decoded = await admin.auth().verifyIdToken(token);
                //console.log('decoded token', decoded);
                req.decoded = decoded;
                next();
            } catch (error) {
                //console.log(error);
                return res.status(403).send({
                    message: 'forbidden access'
                });
            }
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {
                email
            };

            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'admin') {
                return res.status(403).send({
                    message: 'forbidden access'
                })
            }
            next();
        }

        app.post('/users', async (req, res) => {
            try {
                const user = req.body;

                const existing = await usersCollection.findOne({
                    email: user.email
                });

                if (existing) {
                    return res.status(200).json({
                        message: 'User already exists'
                    });
                }

                const result = await usersCollection.insertOne(user);
                res.status(201).json({
                    insertedId: result.insertedId
                });
            } catch (err) {
                console.error('Error adding user:', err);
                res.status(500).json({
                    error: 'Failed to add user'
                });
            }
        });

        app.get('/users/:email/role', verifyFbToken, async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({
                    email
                });

                if (!user) {
                    return res.status(404).send({
                        error: 'User not found'
                    });
                }

                res.send({
                    role: user.role || 'user'
                });

            } catch (error) {
                console.error('Error fetching user role:', error);
                res.status(500).send({
                    error: 'Internal Server Error'
                });
            }
        })

        app.get("/quotes", verifyFbToken, async (req, res) => {
            try {
                const {
                    email
                } = req.query;
                let filter = {};

                if (email) {
                    filter = {
                        submittedBy: email
                    };
                }

                const quotes = await quotesCollection.find(filter).toArray();
                res.status(200).json(quotes);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to fetch quotes",
                    error
                });
            }
        });

        app.get("/quotes/approved", async (req, res) => {
            try {
                const approvedQuotes = await quotesCollection
                    .find({
                        status: "approved"
                    })
                    .toArray();

                res.status(200).json(approvedQuotes);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to fetch approved quotes",
                    error
                });
            }
        });

        app.get("/quotes/latest", async (req, res) => {
            try {
                const latestQuotes = await quotesCollection
                    .find({
                        status: "approved"
                    })
                    .sort({
                        createdAt: -1
                    })
                    .limit(6)
                    .toArray();

                res.status(200).json(latestQuotes);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to fetch latest quotes",
                    error,
                });
            }
        });

        app.get("/quotes/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const quote = await quotesCollection.findOne({
                    _id: new ObjectId(id)
                });
                if (!quote) return res.status(404).json({
                    message: "Quote not found"
                });
                res.status(200).json(quote);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to fetch quote",
                    error
                });
            }
        });

        app.post("/quotes", verifyFbToken, async (req, res) => {
            try {
                const newQuote = req.body;
                const result = await quotesCollection.insertOne(newQuote);
                res.status(201).json(result);
            } catch (error) {
                res.status(500).json({
                    message: "Failed to add quote",
                    error
                });
            }
        });

        app.patch("/quotes/:id", verifyFbToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedQuote = req.body;

                const result = await quotesCollection.updateOne({
                    _id: new ObjectId(id)
                }, {
                    $set: updatedQuote
                });

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        message: "Quote not found"
                    });
                }

                res.status(200).json({
                    message: "Quote updated successfully",
                    modifiedCount: result.modifiedCount,
                });
            } catch (error) {
                console.error("Error updating quote:", error);
                res.status(500).json({
                    message: "Failed to update quote",
                    error
                });
            }
        });


        app.delete('/quotes/:id', verifyFbToken, async (req, res) => {
            try {
                const id = req.params.id;

                const result = await quotesCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                if (result.deletedCount === 1) {
                    res.status(200).json({
                        message: 'Quote deleted successfully',
                        deletedCount: 1
                    });
                } else {
                    res.status(404).json({
                        error: 'Quote not found or already deleted',
                        deletedCount: 0
                    });
                }
            } catch (err) {
                console.error('Error deleting quote:', err);
                res.status(500).json({
                    error: 'Failed to delete quote'
                });
            }
        });

        app.patch("/quotes/:id/status", verifyFbToken, verifyAdmin, async (req, res) => {
            try {
                const id = req.params.id;
                const {
                    status
                } = req.body;

                const result = await quotesCollection.updateOne({
                    _id: new ObjectId(id)
                }, {
                    $set: {
                        status
                    }
                });

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        message: "Quote not found"
                    });
                }

                res.status(200).json({
                    message: "Status updated successfully"
                });
            } catch (error) {
                res.status(500).json({
                    message: "Failed to update status",
                    error
                });
            }
        });


        // await client.db("admin").command({
        //     ping: 1
        // });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Sunnah Sayings is running')
})

app.listen(port, () => {
    console.log(`Sunnah Sayings is running on port: ${port}`)
})