const express = require('express')
const cors = require('cors');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
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
                console.log('Error adding user:', err);
                res.status(500).json({
                    error: 'Failed to add user'
                });
            }
        })

        app.post("/quotes", async (req, res) => {
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