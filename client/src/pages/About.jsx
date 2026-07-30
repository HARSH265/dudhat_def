import React from "react";
import { FaIndustry, FaCheckDouble, FaUsers, FaLeaf } from "react-icons/fa";
import FeatureCard from "../components/FeatureCard";
import facilityImage from "../assets/images/general/facility.png";

const About = () => {
  const features = [
    { icon: FaIndustry, title: "Advanced Manufacturing" },
    { icon: FaCheckDouble, title: "Strict Quality Control" },
    { icon: FaUsers, title: "Customer Satisfaction" },
    { icon: FaLeaf, title: "Sustainable Practices" },
  ];

  return (
    <section className="section about-page">
      <div className="container about-grid">
        <div className="about-text">
          <span className="page-tag">ABOUT US</span>
          <h2>
            Committed to Purity. <br />
            Driven by Performance.
          </h2>
          <p>
            Dhudhat Industries Private Limited is committed to manufacturing
            high quality Diesel Exhaust Fluid (DEF) that meets global
            standards.
          </p>
          <p>
            Our state-of-the-art facility, advanced testing processes and
            customer-first approach ensure consistent quality, purity and
            reliability.
          </p>

          <div className="about-features">
            {features.map((f, i) => (
              <FeatureCard key={i} icon={f.icon} title={f.title} variant="light" />
            ))}
          </div>
        </div>

        <div className="about-image">
          <img src={facilityImage} alt="Dhudhat DEF Manufacturing Facility" />
        </div>
      </div>
    </section>
  );
};

export default About;