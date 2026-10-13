export const validateAstrologyQuery = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      query: req.query,
    });

    req.validated = parsed;

    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors?.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
};
