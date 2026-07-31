import React from "react";
import { FaLeaf, FaRecycle, FaWater, FaSeedling } from "react-icons/fa";
import FeatureCard from "../components/FeatureCard";
import sustainabilityImage from "../assets/images/general/facility.png";

const Sustainability = () => {
  const points = [
    {
      icon: FaLeaf,
      title: "Reduced Emissions",
      description: "Helping vehicles cut harmful NOx emissions industry-wide",
    },
    {
      icon: FaRecycle,
      title: "Recyclable Packaging",
      description: "Our containers are designed to minimize plastic waste",
    },
    {
      icon: FaWater,
      title: "Responsible Manufacturing",
      description: "Water and resource-efficient production processes",
    },
    {
      icon: FaSeedling,
      title: "Greener Tomorrow",
      description: "Committed to a cleaner environment for future generations",
    },
  ];

  return (
    <section className="section sustainability-page">
      <div className="container about-grid">
        <div className="about-text">
          <span className="page-tag">SUSTAINABILITY</span>
          <h1>
            Driving Cleaner <br /> Tomorrow, Today.
          </h1>
          <p>
            At Dudhat DEF, sustainability is at the core of everything we
            do. From manufacturing to packaging, we're committed to reducing
            our environmental footprint.
          </p>
          <p>
            Every can, drum, and tank of Dudhat DEF helps reduce harmful
            NOx emissions — contributing to cleaner air for everyone.
          </p>
        </div>

        <div className="about-image">
          <img
            src={sustainabilityImage}
            alt="Dudhat DEF Sustainability"
            width="1662"
            height="946"
          />
        </div>
      </div>

      <div className="container">
        <div className="feature-grid" style={{ marginTop: "50px" }}>
          {points.map((p, i) => (
            <FeatureCard
              key={i}
              icon={p.icon}
              title={p.title}
              description={p.description}
              variant="light"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Sustainability;