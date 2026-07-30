import React from "react";
import { Link } from "react-router-dom";

const Button = ({ text, to, href, type = "button", variant = "primary", onClick }) => {
  const className = `btn btn-${variant}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {text}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={className}>
        {text}
      </a>
    );
  }

  return (
    <button type={type} className={className} onClick={onClick}>
      {text}
    </button>
  );
};

export default Button;