const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// middleWare
app.use(
  cors({
    //? Cors setUp cookie
    origin: ["http://localhost:5173"], // Your frondEnd
    credentials: true, //Allow Cookies
  })
);
app.use(express.json());

//? cookie parser
app.use(cookieParser());

// ? logger
const logger = (req,res, next) => {
  console.log('inside the  logger middleware');
  next();
};

// ? verify Token
const verifyToken = (req,res, next) => {
  const token = req?.cookies?.token
  console.log('cookie in the  middleware ', token);

  // unauthorized access Token
  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  };

  //? verify
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (error, decoded) => {

    // unauthorized access error
    if(error){
      return res.status(401).send({message: 'unauthorized access'})
    }
    req.decoded = decoded;

      next();
  })



}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sltbrlg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const jobsCollection = client.db("careerCode").collection("jobs");
    const applicationsCollection = client
      .db("careerCode")
      .collection("application");

    //? JWT Token Related api
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      const user = { email };

      //? Generated api
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1h",
      });

      //? Set token in the cookies
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });

      res.send({ success: true });
    });

    // Jobs Api
    // get display all jobs
    app.get("/jobs", async (req, res) => {
      // Query in Email
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // ! explain
    app.get("/jobs/applications", async (req, res) => {
      const email = req.query.email;
      const query = { hr_email: email };
      const jobs = await jobsCollection.find(query).toArray();

      
      //* should use aggregate to have optimum data fetching
      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() };

        const application_count = await applicationsCollection.countDocuments(
          applicationQuery
        );
        job.application_count = application_count;
      }

      res.send(jobs);
    });

    // Job Details
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // Add Jobs
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    //? cookies add hbe 
    app.get("/applications", logger , verifyToken, async (req, res) => {
      const email = req.query.email;


        //  console.log('inside application api ',req.cookies);
        // forbidden access
        if(email !== req.decoded.email){
          return res.status(403).send({message: "forbidden access"})
        }

 
      const query = {
        applicant: email,
      };

      const result = await applicationsCollection.find(query).toArray();

      // Bad way to aggregate data
      for (const application of result) {
        const jobId = application.jobId;
        const jobQuery = { _id: new ObjectId(jobId) };
        const job = await jobsCollection.findOne(jobQuery);
        application.company = job.company;
        application.title = job.title;
        application.company_logo = job.company_logo;
      }

      res.send(result);
    });

    // applications Jobs id
    app.get("/applications/jobs/:id", async (req, res) => {
      const job_id = req.params.jobs_id;
      const query = { jobId: job_id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // jobs application related apis
    app.post("/applications", async (req, res) => {
      const application = req.body;

      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const UpdateDoc = {
        $set: {
          status: req.body.status,
        },
      };

      const result = await applicationsCollection.updateOne(filter, UpdateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Career code is running ...");
});

app.listen(port, () => {
  console.log(`Career code Server is running on ${port}`);
});
