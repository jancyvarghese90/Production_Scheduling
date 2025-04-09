const express = require("express");
const router = express.Router();
const orderModel = require("../models/Order");
router.use(express.json());

router.get("/", async (req, res) => {
  try {
    var data = await orderModel.find();
    res.status(200).json(data);
  } catch (error) {
    res.send("unable to find data");
  }
});

router.post("/add", async (req, res) => {
  try {
    console.log("🔄 Received POST request:", req.body); // Log the request body

    var item = req.body;
    var data = await orderModel(item).save();

    console.log("✅ Data saved to database:", data); // Log the saved data
    res.status(200).send({ message: "Data added", data });
  } catch (error) {
    console.error("❌ Error saving data:", error.message); // Log the error
    res.status(500).send("Couldn't add data");
  }
});

router.put("/edit/:id", async (req, res) => {
  try {
    await orderModel.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json({message:"Data updated successfully"});
  } catch (error) {
    res.send(error);
  }
});

  router.delete("/delete/:id", async (req,res)=>{
    try {
        await orderModel.findByIdAndDelete(req.params.id)
        res.status(200).send("Deleted successfully")
    } catch (error) {
        res.send("couldn't delete")
    }
  })

module.exports = router;
