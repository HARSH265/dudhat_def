import type { Request, Response } from "express";
import Contact from "../models/Contact";

// @desc    Save a new contact form submission
// @route   POST /api/contact
//
// NOTE: validation, business logic and persistence are still in one function.
// Split into validator + service + repository in Phase 1B.
// docs/API_SPECIFICATION.md §3
export const submitContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, email, phone, company, message } = req.body ?? {};

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

    // Response carries the identifier only. Previously it returned the whole
    // document, disclosing internal fields to an anonymous caller.
    // docs/API_SPECIFICATION.md §4.3
    return res.status(201).json({
      success: true,
      message: "Thank you! Your message has been sent successfully.",
      data: { id: newContact.id },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};
