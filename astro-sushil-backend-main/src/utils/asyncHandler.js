import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";

export const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }

    console.error(err.stack);

    return res
      .status(500)
      .json(new ApiResponse(500, null, err.message || "Something went wrong"));
  }
};


