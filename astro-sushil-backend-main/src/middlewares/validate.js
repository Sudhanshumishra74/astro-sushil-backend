export const validate = (schema, location = "body") => (req, res, next) => {
  try {
    let data;

    if (location === "params") data = req.params;
    else if (location === "query") data = req.query;
    else data = req.body;

    const parsed = schema.parse(data);

    
    req.validatedData = parsed;

    next();
  } catch (error) {
    const formattedErrors = error.issues?.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    return res.status(400).json({
      success: false,
      message: formattedErrors?.[0]?.message || "Validation error",
      errors: formattedErrors,
    });
  }
};