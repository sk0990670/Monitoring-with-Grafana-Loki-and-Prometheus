const express = require('express');
const responseTime = require('response-time');
const client = require("prom-client"); //metrix collection

const { createLogger, transports } = require("winston");
const LokiTransport = require("winston-loki");
const options = {


  transports: [
    new LokiTransport({
        label: {
            appName: "express",
        },
      host: "http://127.0.0.1:3100"
    })
  ]

};
const logger = createLogger(options);


const { doSomeHeavyTask } = require('./util'); // Import the doSomeHeavyTask function from util.js
const app = express();
const port = process.env.PORT || 8000

const collectDefaultMetrics = client.collectDefaultMetrics;

collectDefaultMetrics({ register: client.register});

const reqResTime = new client.Histogram({
    name: "http_express_req_res_time",
    help: "This tells how much time is taken by req and res",
    labelName: ["method", "route", "status_code"],
    buckets:[1,50,100,200,400,500,800,1000,2000],
});

const totalReqCounter = new client.Counter({
    name: 'total_req',
    help: 'Tells total req',
});

app.use(responseTime((req, res, time) => {
    totalReqCounter.inc();
    reqResTime
     .labels({
         method: req.method,
         route: req.url,
         status_code: res.statusCode,
     })
     .observe(time);

}));

// Basic route
app.get("/", (req, res) => {
    logger.info("Req came on / router");
    return res.json({ message: 'Hello from Express Server' });
});

// Slow route
app.get("/slow", async (req, res) => {

    try {
        logger.info("Req came on / slow router");
        const timeTaken = await doSomeHeavyTask();
        return res.json({
            status: 'Success',
            message: `Heavy task completed in ${timeTaken}ms`,
        });
    } catch (error) {
        logger.error(`${error.message}`);
        return res
        .status(500)
        .json({status: "Error", error: "Internal Server Error"});
    }
});

app.get("/metrics", async(req, res) => {
    res.setHeader('Content-Type', client.register.contentType)
    const metrics = await client.register.metrics();
    res.send(metrics);
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
