import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static("public"));

app.get("/", (req, res)=>{
        res.render("index.ejs");
});

app.listen(PORT, ()=>{
    console.log(`Listening on port: ${PORT}`);
});