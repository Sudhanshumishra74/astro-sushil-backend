import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("ERROR:", err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
  const errors = Object.entries(err.keyValue || {}).map(
    ([field, value]) => ({
      field,
      message: `${field} "${value}" already exists. Please use a different ${field}.`,
    })
  );

  return res.status(400).json({
    success: false,
    message: "Duplicate value error",
    errors,
  });
}

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

export { errorHandler };
