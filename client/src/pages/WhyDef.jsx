import React from "react";
import { FaTruck, FaCogs, FaExchangeAlt, FaLeaf, FaArrowRight } from "react-icons/fa";

const WhyDef = () => {
  const steps = [
    {
      icon: FaTruck,
      title: "Injected into",
      subtitle: "Exhaust System",
    },
    {
      icon: FaCogs,
      title: "React with NOx in",
      subtitle: "SCR Catalyst",
    },
    {
      icon: FaExchangeAlt,
      title: "Convert NOx into",
      subtitle: "Nitrogen & Water",
    },
    {
      icon: FaLeaf,
      title: "Cleaner Emissions,",
      subtitle: "Better Environment",
    },
  ];

  return (
    <>
      <section className="section why-def-page">
        <div className="container">
          <h1 className="section-title">Why DEF is Essential?</h1>
          <p className="section-subtitle">
            DEF is a critical solution used in SCR (Selective Catalytic
            Reduction) systems to reduce harmful nitrogen oxide (NOx)
            emissions.
          </p>

          <div className="process-flow">
            {steps.map((step, i) => (
              <React.Fragment key={i}>
                <div className="process-step">
                  <div className="process-icon">
                    <step.icon />
                  </div>
                  <p className="process-title">{step.title}</p>
                  <p className="process-subtitle">{step.subtitle}</p>
                </div>
                {i < steps.length - 1 && (
                  <FaArrowRight className="process-arrow" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-banner">
        <p>Use Dhudhat DEF. Drive Clean. Breathe Clean.</p>
      </div>
    </>
  );
};

export default WhyDef;