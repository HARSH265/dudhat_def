const Contact = require("../models/Contact");

// @desc    Save a new contact form submission
// @route   POST /api/contact
const submitContact = async (req, res) => {
  try {
    const { name, email, phone, company, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields (name, email, phone, message)",
      });
    }

    const newContact = await Contact.create({
      name,
      email,
      phone,
      company,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Thank you! Your message has been sent successfully.",
      data: newContact,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};


module.exports = { submitContact };