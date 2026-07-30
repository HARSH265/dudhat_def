import React from "react";
import { FaPhoneAlt, FaEnvelope, FaGlobe, FaMapMarkerAlt } from "react-icons/fa";
import ContactForm from "../components/ContactForm";

const Contact = () => {
  return (
    <section className="section contact-page">
      <div className="container contact-grid">
        <div className="contact-info">
          <h2>Get In Touch</h2>
          <p>
            We are here to answer your questions and support your business.
          </p>

          <ul className="contact-details">
            <li>
              <span className="contact-icon"><FaPhoneAlt /></span>
              +91 12345 67890
            </li>
            <li>
              <span className="contact-icon"><FaEnvelope /></span>
              info@dhudhatdef.com
            </li>
            <li>
              <span className="contact-icon"><FaGlobe /></span>
              www.dhudhatdef.com
            </li>
            <li>
              <span className="contact-icon"><FaMapMarkerAlt /></span>
              Dhudhat Industries Private Limited, Plot No. ___, MIDC,
              ________, Maharashtra, India.
            </li>
          </ul>
        </div>

        <div className="contact-form-wrapper">
          <ContactForm />
        </div>
      </div>
    </section>
  );
};

export default Contact;