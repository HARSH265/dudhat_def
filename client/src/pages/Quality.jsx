import React from "react";
import { FaCheck } from "react-icons/fa";
import labImage from "../assets/images/general/lab-testing.png";

const Quality = () => {
  const checklist = [
    "Raw Material Testing",
    "In-Process Quality Check",
    "Finished Product Testing",
    "ISO 22241 Standards",
    "Batch Traceability & Records",
  ];

  return (
    <>
      <section className="section quality-page">
        <div className="container quality-grid">
          <div className="quality-text">
            <h1>Quality You Can Trust</h1>
            <p>
              We follow strict quality control at every stage to ensure
              purity, performance and reliability.
            </p>

            <ul className="quality-checklist">
              {checklist.map((item, i) => (
                <li key={i}>
                  <span className="check-icon">
                    <FaCheck />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="quality-image">
            <img
              src={labImage}
              alt="Quality Testing Laboratory"
              width="1508"
              height="1043"
            />
          </div>
        </div>
      </section>

      <div className="cta-banner">
        <p>We follow ISO 22241 standards for guaranteed quality.</p>
      </div>
    </>
  );
};

export default Quality;