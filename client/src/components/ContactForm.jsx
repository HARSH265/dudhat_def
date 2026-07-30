import React, { useState } from "react";
import axios from "axios";

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const [status, setStatus] = useState({ loading: false, success: null, message: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, message: "" });

    try {
      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const res = await axios.post(`${API_URL}/api/contact`, formData);

      setStatus({ loading: false, success: true, message: res.data.message });
      setFormData({ name: "", email: "", phone: "", company: "", message: "" });
    } catch (error) {
      setStatus({
        loading: false,
        success: false,
        message:
          error.response?.data?.message || "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-row">
        <input
          type="tel"
          name="phone"
          placeholder="Your Phone"
          value={formData.phone}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="company"
          placeholder="Your Company"
          value={formData.company}
          onChange={handleChange}
        />
      </div>

      <textarea
        name="message"
        placeholder="Your Message"
        rows="5"
        value={formData.message}
        onChange={handleChange}
        required
      ></textarea>

      <button type="submit" className="btn-send" disabled={status.loading}>
        {status.loading ? "Sending..." : "Send Message"}
      </button>

      {status.message && (
        <p className={`form-status ${status.success ? "success" : "error"}`}>
          {status.message}
        </p>
      )}
    </form>
  );
};

export default ContactForm;